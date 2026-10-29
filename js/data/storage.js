/* ==========================================================================
   Storage: IndexedDB (default) + File System Access folder mirror
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;

  const DB_NAME = "sizhiliu";
  const DB_VERSION = 1;
  const STORE = "kv";
  const LOCAL_KEY = "sizhiliu.state.v1";
  const HANDLE_KEY = "folderHandle";
  const FOLDER_FILE = "sizhiliu.json";

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持 IndexedDB"));
        return;
      }
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("无法打开本地数据库"));
      req.onblocked = () => reject(new Error("本地数据库被其他窗口占用"));
    });
  }

  function withTimeout(promise, ms, message) {
    let timer = null;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message || "本地存储超时")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function idbRequest(db, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let request;
      try {
        request = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(request && "result" in request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || new Error("本地数据库读写失败"));
      tx.onabort = () => reject(tx.error || new Error("本地数据库事务被取消"));
    });
  }

  function Storage() {
    this.events = new SZL.Events();
    this.db = null;
    this.dbBroken = false;
    this.dirHandle = null;
    this.folderReady = false;
    this.folderName = "";
    this.lastSavedAt = null;
    this._pending = null;
    this._timer = null;
    this._writing = false;
    this.supportsFolder = typeof window.showDirectoryPicker === "function";
  }

  Storage.prototype.on = function on(name, handler) {
    return this.events.on(name, handler);
  };

  Storage.prototype._emit = function _emit(name, payload) {
    this.events.emit(name, payload);
  };

  Storage.prototype.init = async function init() {
    try {
      this.db = await withTimeout(openDB(), 2200, "IndexedDB 打开超时");
    } catch (err) {
      console.warn("[思之流] IndexedDB 不可用，改用 localStorage", err);
      this.db = null;
      this.dbBroken = true;
    }
    try {
      await withTimeout(this._restoreFolderHandle(), 1200, "数据文件夹恢复超时");
    } catch (err) {
      console.warn("[思之流] 恢复数据文件夹超时", err);
    }
    return this;
  };

  Storage.prototype._idbGet = async function _idbGet(key) {
    if (!this.db) return undefined;
    try {
      return await withTimeout(
        idbRequest(this.db, "readonly", (store) => store.get(key)),
        1600,
        "读取本地数据库超时"
      );
    } catch (err) {
      console.warn("[思之流] 读取 IndexedDB 失败", err);
      return undefined;
    }
  };

  Storage.prototype._idbSet = async function _idbSet(key, value) {
    if (!this.db) return false;
    try {
      await withTimeout(
        idbRequest(this.db, "readwrite", (store) => store.put(value, key)),
        1800,
        "写入本地数据库超时"
      );
      return true;
    } catch (err) {
      console.warn("[思之流] 写入 IndexedDB 失败", err);
      return false;
    }
  };

  Storage.prototype._idbDelete = async function _idbDelete(key) {
    if (!this.db) return;
    try {
      await idbRequest(this.db, "readwrite", (store) => store.delete(key));
    } catch (err) {
      console.warn("[思之流] 删除 IndexedDB 记录失败", err);
    }
  };

  /* ---------- local state ---------- */

  Storage.prototype.loadLocal = async function loadLocal() {
    const fromDB = await this._idbGet("state");
    let fromLocal = null;
    try {
      fromLocal = localStorage.getItem(LOCAL_KEY);
    } catch (err) {
      fromLocal = null;
    }

    function parse(raw) {
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return SZL.model.normalizeState(parsed);
      } catch (err) {
        console.warn("[思之流] 本地数据损坏，已忽略", err);
        return null;
      }
    }

    const states = [parse(fromDB), parse(fromLocal)].filter(Boolean);
    if (!states.length) return null;
    states.sort((a, b) => {
      const aTime = Date.parse((a.meta && a.meta.updatedAt) || 0) || 0;
      const bTime = Date.parse((b.meta && b.meta.updatedAt) || 0) || 0;
      return bTime - aTime;
    });
    return states[0];
  };

  Storage.prototype._writeLocal = async function _writeLocal(state) {
    const text = JSON.stringify(state);
    let wrote = false;
    if (this.db) wrote = await this._idbSet("state", text);
    try {
      localStorage.setItem(LOCAL_KEY, text);
      wrote = true;
    } catch (err) {
      /* quota or private mode — IndexedDB may still hold it */
    }
    if (!wrote) throw new Error("无法保存到本地存储");
  };

  Storage.prototype.queueSave = function queueSave(state) {
    this._pending = state;
    if (this._timer) clearTimeout(this._timer);
    this._emit("saving");
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, 350);
  };

  Storage.prototype.flush = async function flush() {
    if (this._writing) return;
    const state = this._pending;
    if (!state) return;
    this._pending = null;
    this._writing = true;
    try {
      await this._writeLocal(state);
      let folderWritten = false;
      if (
        this.dirHandle &&
        this.folderReady &&
        state.settings &&
        state.settings.autoSaveFolder
      ) {
        try {
          await this._writeFolder(state);
          folderWritten = true;
        } catch (err) {
          console.warn("[思之流] 写入数据文件夹失败", err);
        }
      }
      this.lastSavedAt = new Date().toISOString();
      this._emit("saved", { at: this.lastSavedAt, folder: folderWritten });
    } catch (err) {
      console.error("[思之流] 保存失败", err);
      this._emit("error", err);
    } finally {
      this._writing = false;
      if (this._pending) this.queueSave(this._pending);
    }
  };

  Storage.prototype.saveNow = async function saveNow(state) {
    this._pending = state;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    await this.flush();
  };

  /* ---------- folder ---------- */

  Storage.prototype._restoreFolderHandle = async function _restoreFolderHandle() {
    if (!this.supportsFolder) return;
    try {
      const handle = await this._idbGet(HANDLE_KEY);
      if (!handle) return;
      this.dirHandle = handle;
      this.folderName = handle.name || "";
      const opts = { mode: "readwrite" };
      const permission = await handle.queryPermission(opts);
      this.folderReady = permission === "granted";
      if (this.folderReady) this._emit("folder", { handle, ready: true });
    } catch (err) {
      console.warn("[思之流] 无法恢复数据文件夹", err);
    }
  };

  Storage.prototype.chooseFolder = async function chooseFolder() {
    if (!this.supportsFolder) {
      throw new Error("当前浏览器不支持选择本地文件夹，请使用 Chrome / Edge 打开。");
    }
    const handle = await window.showDirectoryPicker({
      id: "sizhiliu",
      mode: "readwrite",
      startIn: "documents",
    });
    this.dirHandle = handle;
    this.folderName = handle.name || "";
    this.folderReady = true;
    await this._idbSet(HANDLE_KEY, handle);
    this._emit("folder", { handle, ready: true });
    return handle;
  };

  Storage.prototype.reconnectFolder = async function reconnectFolder() {
    if (!this.dirHandle) return false;
    try {
      const opts = { mode: "readwrite" };
      const permission = await this.dirHandle.requestPermission(opts);
      this.folderReady = permission === "granted";
      if (this.folderReady) this._emit("folder", { handle: this.dirHandle, ready: true });
      return this.folderReady;
    } catch (err) {
      console.warn("[思之流] 重新连接文件夹失败", err);
      return false;
    }
  };

  Storage.prototype.disconnectFolder = async function disconnectFolder() {
    this.dirHandle = null;
    this.folderReady = false;
    this.folderName = "";
    await this._idbDelete(HANDLE_KEY);
    this._emit("folder", { handle: null, ready: false });
  };

  Storage.prototype._writeFolder = async function _writeFolder(state) {
    if (!this.dirHandle) throw new Error("尚未选择数据文件夹");
    const fileHandle = await this.dirHandle.getFileHandle(FOLDER_FILE, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
  };

  Storage.prototype.readFolderState = async function readFolderState() {
    if (!this.dirHandle || !this.folderReady) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(FOLDER_FILE);
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (!text.trim()) return null;
      return SZL.model.normalizeState(JSON.parse(text));
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === 3)) return null;
      console.warn("[思之流] 读取数据文件夹失败", err);
      throw err;
    }
  };

  Storage.prototype.saveToFolder = async function saveToFolder(state) {
    if (!this.dirHandle || !this.folderReady) throw new Error("数据文件夹未连接");
    await this._writeFolder(state);
    this.lastSavedAt = new Date().toISOString();
    this._emit("saved", { at: this.lastSavedAt, folder: true });
  };

  /* ---------- files ---------- */

  Storage.prototype.exportState = function exportState(state) {
    const date = util.formatDate(new Date()).replace(/\./g, "");
    util.downloadJSON("思之流-" + date + ".json", state);
  };

  Storage.prototype.fileName = FOLDER_FILE;

  SZL.Storage = Storage;
})();
