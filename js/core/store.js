/* ==========================================================================
   Store: single source of truth + actions
   Views subscribe to "change" with a reason; all writes are persisted.
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;

  function Store(storage, initialState) {
    this.storage = storage;
    this.events = new SZL.Events();
    this.state = model.normalizeState(initialState) || SZL.seed.create();
    this._saveTimer = null;
  }

  Store.prototype.on = function on(name, handler) {
    return this.events.on(name, handler);
  };

  Store.prototype.emit = function emit(name, payload) {
    this.events.emit(name, payload);
  };

  Store.prototype._commit = function _commit(reason, detail) {
    this.state.meta.updatedAt = new Date().toISOString();
    this.storage.queueSave(this.state);
    this.emit("change", Object.assign({ reason }, detail || {}));
  };

  Store.prototype.items = function items() {
    return this.state.items;
  };

  Store.prototype.settings = function settings() {
    return this.state.settings;
  };

  Store.prototype.getItem = function getItem(id) {
    return this.state.items.find((item) => item.id === id) || null;
  };

  Store.prototype.stats = function stats() {
    return model.stats(this.state.items);
  };

  Store.prototype.tags = function tags() {
    return model.buildTagTree(this.state.items);
  };

  Store.prototype.tagOptions = function tagOptions() {
    return model.tagOptions(this.state.items);
  };

  Store.prototype.itemsByTag = function itemsByTag(path) {
    if (!path) return this.state.items.slice();
    return this.state.items.filter((item) =>
      (item.review.tags || []).some((tag) => tag === path || tag.startsWith(path + "/"))
    );
  };

  /* ---------- items ---------- */

  Store.prototype.addItem = function addItem(input) {
    const item = model.createItem(input);
    this.state.items.unshift(item);
    this._commit("add", { id: item.id });
    return item;
  };

  Store.prototype.addItems = function addItems(list) {
    if (!list || !list.length) return [];
    const items = list.map((entry) => model.createItem(entry));
    this.state.items = items.concat(this.state.items);
    this._commit("add-many", { count: items.length });
    return items;
  };

  Store.prototype.updateItem = function updateItem(id, patch) {
    const item = this.getItem(id);
    if (!item) return null;
    ["title", "url", "author", "cover", "summary", "duration", "source", "shape", "likedAt"].forEach(
      (key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          item[key] = patch[key];
        }
      }
    );
    if (patch.source && !model.SOURCES[patch.source]) item.source = model.detectSource(item.url);
    item.url = model.safeUrl(item.url);
    item.updatedAt = new Date().toISOString();
    if (!util.toDate(item.likedAt)) item.likedAt = item.updatedAt;
    this._commit("update", { id });
    return item;
  };

  Store.prototype.setReview = function setReview(id, patch) {
    const item = this.getItem(id);
    if (!item) return null;
    const review = item.review;
    if (Object.prototype.hasOwnProperty.call(patch, "rating")) {
      review.rating = util.clamp(Math.round(Number(patch.rating) || 0), 0, 5);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "note")) {
      review.note = String(patch.note == null ? "" : patch.note).replace(/\s+$/g, "");
    }
    if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
      review.tags = model.normalizeTags(patch.tags);
    }
    const hasContent = review.rating > 0 || review.note.trim().length > 0;
    review.reviewedAt = hasContent ? new Date().toISOString() : null;
    item.updatedAt = review.reviewedAt || new Date().toISOString();
    this._commit("review", { id });
    return item;
  };

  Store.prototype.removeItem = function removeItem(id) {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const item = this.state.items.splice(index, 1)[0];
    this._commit("delete", { id, index });
    return { item, index };
  };

  Store.prototype.restoreItem = function restoreItem(item, index) {
    if (!item) return null;
    const normalized = model.normalizeItem(item);
    const safeIndex = util.clamp(Number(index) || 0, 0, this.state.items.length);
    this.state.items.splice(safeIndex, 0, normalized);
    this._commit("restore", { id: normalized.id });
    return normalized;
  };

  /* ---------- settings ---------- */

  Store.prototype.setSettings = function setSettings(patch) {
    Object.assign(this.state.settings, patch);
    this._commit("settings", { keys: Object.keys(patch) });
    return this.state.settings;
  };

  Store.prototype.markDemoNotice = function markDemoNotice() {
    this.state.settings.demoNoticeDismissed = true;
    this._commit("settings", { keys: ["demoNoticeDismissed"] });
  };

  /* ---------- data lifecycle ---------- */

  Store.prototype.importState = function importState(raw, mode) {
    const incoming = model.normalizeState(raw);
    if (!incoming) throw new Error("文件格式不是思之流的数据。");
    if (mode === "merge") {
      const existing = new Set(this.state.items.map((item) => item.id));
      const added = incoming.items.filter((item) => !existing.has(item.id));
      this.state.items = added.concat(this.state.items);
      this.state.meta.demo = false;
      this._commit("import", { mode: "merge", count: added.length });
      return added.length;
    }
    const keepSettings = this.state.settings;
    this.state = incoming;
    this.state.settings = Object.assign({}, this.state.settings, {
      theme: keepSettings.theme,
      density: keepSettings.density,
      motion: keepSettings.motion,
      folderName: keepSettings.folderName,
    });
    this._commit("import", { mode: "replace", count: this.state.items.length });
    return this.state.items.length;
  };

  Store.prototype.resetDemo = function resetDemo() {
    const settings = this.state.settings;
    this.state = SZL.seed.create();
    this.state.settings = Object.assign(this.state.settings, {
      theme: settings.theme,
      density: settings.density,
      motion: settings.motion,
    });
    this._commit("reset", {});
    return this.state;
  };

  Store.prototype.clearAll = function clearAll() {
    const settings = this.state.settings;
    this.state = SZL.seed.empty();
    this.state.settings = Object.assign(this.state.settings, {
      theme: settings.theme,
      density: settings.density,
      motion: settings.motion,
    });
    this._commit("clear", {});
    return this.state;
  };

  /* ---------- helpers ---------- */

  Store.prototype.unreviewed = function unreviewed() {
    return this.state.items.filter((item) => !model.isReviewed(item));
  };

  Store.prototype.randomItem = function randomItem(pool) {
    const list = pool && pool.length ? pool : this.state.items;
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  };

  Store.prototype.flush = async function flush() {
    await this.storage.saveNow(this.state);
  };

  SZL.Store = Store;
})();
