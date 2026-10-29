/* ==========================================================================
   思之流 · tiny DOM / format utilities (no dependencies)
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = (SZL.util = {});

  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  /* ---------- DOM ---------- */

  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach((c) => append(parent, c));
      return;
    }
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  /**
   * el("div", { class: "x", text: "hi", on: { click: fn }, dataset: { id: 1 } }, [children])
   */
  util.el = function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        const value = props[key];
        if (value == null || value === false) return;
        if (key === "class" || key === "className") {
          node.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : value;
        } else if (key === "text") {
          node.textContent = value;
        } else if (key === "html") {
          node.innerHTML = value;
        } else if (key === "dataset") {
          Object.keys(value).forEach((k) => {
            if (value[k] != null) node.dataset[k] = value[k];
          });
        } else if (key === "style") {
          Object.keys(value).forEach((k) => {
            if (k.startsWith("--")) node.style.setProperty(k, value[k]);
            else node.style[k] = value[k];
          });
        } else if (key === "attrs") {
          Object.keys(value).forEach((k) => {
            if (value[k] == null || value[k] === false) return;
            node.setAttribute(k, value[k] === true ? "" : value[k]);
          });
        } else if (key === "on") {
          Object.keys(value).forEach((k) => node.addEventListener(k, value[k]));
        } else {
          node[key] = value;
        }
      });
    }
    append(node, children);
    return node;
  };

  util.frag = function frag(children) {
    const f = document.createDocumentFragment();
    append(f, children);
    return f;
  };

  util.clear = function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  util.qs = (sel, root) => (root || document).querySelector(sel);
  util.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- strings ---------- */

  util.escapeHTML = function escapeHTML(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  util.escapeRegExp = function escapeRegExp(str) {
    return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  util.truncate = function truncate(str, max) {
    const s = String(str == null ? "" : str);
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - 1)) + "…";
  };

  util.softWrap = function softWrap(str) {
    return String(str == null ? "" : str).replace(/\s+/g, " ").trim();
  };

  /* ---------- numbers & ids ---------- */

  util.clamp = function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  };

  util.uid = function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return (prefix || "id") + "_" + Date.now().toString(36) + rand;
  };

  util.hash = function hash(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  util.mulberry32 = function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  util.unique = function unique(list) {
    return Array.from(new Set(list));
  };

  /* ---------- timing ---------- */

  util.debounce = function debounce(fn, wait) {
    let timer = null;
    function debounced() {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(null, args);
      }, wait);
    }
    debounced.cancel = () => clearTimeout(timer);
    debounced.flush = function () {
      clearTimeout(timer);
      timer = null;
    };
    return debounced;
  };

  util.throttle = function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function throttled() {
      const now = Date.now();
      const remaining = wait - (now - last);
      const args = arguments;
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(null, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(null, args);
        }, remaining);
      }
    };
  };

  util.nextFrame = function nextFrame(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  };

  util.prefersReducedMotion = function prefersReducedMotion() {
    return (
      document.documentElement.dataset.motion === "off" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    );
  };

  /* ---------- dates ---------- */

  function toDate(value) {
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  util.toDate = toDate;

  util.formatDate = function formatDate(value) {
    const d = toDate(value);
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "." + m + "." + day;
  };

  util.formatShortDate = function formatShortDate(value) {
    const d = toDate(value);
    if (!d) return "";
    return String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  };

  util.formatClock = function formatClock(value) {
    const d = toDate(value);
    if (!d) return "";
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };

  util.formatStamp = function formatStamp(value) {
    const d = toDate(value);
    if (!d) return "";
    return util.formatShortDate(d) + " " + util.formatClock(d);
  };

  util.formatRelative = function formatRelative(value) {
    const d = toDate(value);
    if (!d) return "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfToday - startOfDay) / 86400000);
    if (days === 0) {
      const mins = Math.round((now - d) / 60000);
      if (mins < 1) return "刚刚";
      if (mins < 60) return mins + " 分钟前";
      return "今天 " + util.formatClock(d);
    }
    if (days === 1) return "昨天";
    if (days < 7) return days + " 天前";
    if (days < 30) return Math.floor(days / 7) + " 周前";
    if (days < 365) return Math.floor(days / 30) + " 个月前";
    return Math.floor(days / 365) + " 年前";
  };

  util.todayLabel = function todayLabel(date) {
    const d = date || new Date();
    return (
      d.getFullYear() +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      String(d.getDate()).padStart(2, "0") +
      " " +
      WEEK[d.getDay()]
    );
  };

  util.toLocalInput = function toLocalInput(value) {
    const d = toDate(value) || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  };

  util.fromLocalInput = function fromLocalInput(value) {
    if (!value) return new Date().toISOString();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  util.isSameDay = function isSameDay(a, b) {
    const da = toDate(a);
    const db = toDate(b);
    if (!da || !db) return false;
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  };

  /* ---------- misc ---------- */

  util.isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

  util.modKey = function modKey() {
    return util.isMac ? "⌘" : "Ctrl";
  };

  util.isUrl = function isUrl(text) {
    return /^https?:\/\/\S+$/i.test(String(text || "").trim());
  };

  util.copyText = function copyText(text) {
    const value = String(text == null ? "" : text);
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).catch(() => fallbackCopy(value));
    }
    return Promise.resolve(fallbackCopy(value));
  };

  function fallbackCopy(value) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  util.downloadJSON = function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  util.readFileText = function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
      reader.readAsText(file, "utf-8");
    });
  };

  /* ---------- icons (trusted static markup) ---------- */

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="8.5" y="8.5" width="10.5" height="10.5" rx="1.6"/><path d="M15.5 5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11.5 12.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    expand: '<path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"/>',
    collapse: '<path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    trash: '<path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M6.5 7l.8 11.2a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/><path d="M10 11v4.5M14 11v4.5"/>',
    edit: '<path d="m4 20 4.6-1.1L19 8.5a2.1 2.1 0 0 0-3-3L5.1 15.4 4 20Z"/><path d="m13.6 7.9 3 3"/>',
    shuffle: '<path d="M3 7h2.5l3 3M3 17h2.5l9.5-9.5H21M17.5 4l3.5 3.5L17.5 11"/><path d="M14 14.5 17 17.5h4M17.5 14.5l3.5 3.5-3.5 3.5"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    chevronUp: '<path d="m8 14 4-4 4 4"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
    download: '<path d="M12 4v10m0 0 4-4m-4 4-4-4"/><path d="M5 18h14"/>',
    upload: '<path d="M12 20V10m0 0 4 4m-4-4-4 4"/><path d="M5 6h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.4 1.4"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.4-1.4"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.2l3 1.8"/>',
    eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-13 0 9-5 13-12 13"/><path d="M5 19c2-5 5-8 10-10"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.4"/><path d="m4.5 17 4.8-4.5 3.2 3 2.5-2.3 4.5 4.3"/>',
    hash: '<path d="M9 4 7.5 20M16.5 4 15 20M4 9h16M3 15h16"/>',
    sliders: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.2"/><circle cx="15" cy="17" r="2.2"/>',
  };

  util.icon = function icon(name, size, className) {
    const body = ICONS[name];
    if (!body) return "";
    const s = size || 16;
    return (
      '<svg class="' +
      (className || "") +
      '" viewBox="0 0 24 24" width="' +
      s +
      '" height="' +
      s +
      '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      body +
      "</svg>"
    );
  };
})();
