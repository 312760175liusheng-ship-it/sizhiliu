/* ==========================================================================
   Data model: sources, tags, normalization
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = (SZL.model = {});

  model.SCHEMA_VERSION = 1;

  const SOURCES = {
    bilibili: { label: "B站", short: "BILIBILI", color: "#fb7299" },
    xiaohongshu: { label: "小红书", short: "RED", color: "#ff2442" },
    zhihu: { label: "知乎", short: "ZHIHU", color: "#1772f6" },
    wechat: { label: "公众号", short: "WECHAT", color: "#07c160" },
    douyin: { label: "抖音", short: "DOUYIN", color: "#161823" },
    youtube: { label: "YouTube", short: "YOUTUBE", color: "#ff0033" },
    weibo: { label: "微博", short: "WEIBO", color: "#e6162d" },
    kuaishou: { label: "快手", short: "KUAISHOU", color: "#ff4906" },
    web: { label: "网页", short: "WEB", color: "#a99f8c" },
  };
  model.SOURCES = SOURCES;
  model.SOURCE_KEYS = Object.keys(SOURCES);

  model.sourceMeta = function sourceMeta(key) {
    return SOURCES[key] || SOURCES.web;
  };

  model.detectSource = function detectSource(url) {
    let host = "";
    try {
      host = new URL(String(url || "")).hostname.toLowerCase();
    } catch (e) {
      return "web";
    }
    if (/(^|\.)bilibili\.com$|(^|\.)b23\.tv$/.test(host)) return "bilibili";
    if (/(^|\.)xiaohongshu\.com$|(^|\.)xhslink\.com$/.test(host)) return "xiaohongshu";
    if (/(^|\.)zhihu\.com$/.test(host)) return "zhihu";
    if (host === "mp.weixin.qq.com" || /(^|\.)weixin\.qq\.com$/.test(host)) return "wechat";
    if (/(^|\.)douyin\.com$|(^|\.)iesdouyin\.com$/.test(host)) return "douyin";
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
    if (/(^|\.)weibo\.com$|(^|\.)weibo\.cn$|(^|\.)t\.cn$/.test(host)) return "weibo";
    if (/(^|\.)kuaishou\.com$|(^|\.)kwai\.com$|(^|\.)gifshow\.com$/.test(host)) return "kuaishou";
    return "web";
  };

  // Only http(s) links are allowed in hrefs. Imported files may contain anything.
  model.safeUrl = function safeUrl(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return "";
    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch (err) {
      /* not a valid absolute URL */
    }
    return "";
  };

  /* ---------- tags ---------- */

  model.normalizeTag = function normalizeTag(raw) {
    let tag = String(raw == null ? "" : raw).trim();
    tag = tag.replace(/^#+/, "").trim();
    tag = tag.replace(/\s*\/\s*/g, "/");
    const parts = tag
      .split("/")
      .map((p) => util.softWrap(p))
      .filter(Boolean)
      .slice(0, 3);
    return parts.join("/");
  };

  model.normalizeTags = function normalizeTags(raw) {
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") list = raw.split(/[,，、;；\n]+/);
    const seen = new Set();
    const out = [];
    list.forEach((entry) => {
      const tag = model.normalizeTag(entry);
      if (!tag) return;
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(tag);
    });
    return out;
  };

  model.tagName = function tagName(path) {
    const parts = String(path || "").split("/");
    return parts[parts.length - 1] || "";
  };

  model.tagParent = function tagParent(path) {
    const parts = String(path || "").split("/");
    parts.pop();
    return parts.join("/");
  };

  model.tagAncestors = function tagAncestors(path) {
    const parts = String(path || "").split("/").filter(Boolean);
    const out = [];
    for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join("/"));
    return out;
  };

  /**
   * Build a tag tree from items. Every node keeps direct + rolled-up counts.
   */
  model.buildTagTree = function buildTagTree(items) {
    const nodes = new Map();
    const root = { path: "", name: "", depth: 0, children: [], direct: 0, total: 0, itemIds: [] };

    function ensure(path) {
      if (nodes.has(path)) return nodes.get(path);
      const parts = path.split("/");
      const node = {
        path,
        name: parts[parts.length - 1],
        depth: parts.length,
        parent: parts.length > 1 ? parts.slice(0, -1).join("/") : "",
        children: [],
        direct: 0,
        total: 0,
        itemIds: [],
      };
      nodes.set(path, node);
      const parent = parts.length > 1 ? ensure(parts.slice(0, -1).join("/")) : root;
      parent.children.push(node);
      return node;
    }

    (items || []).forEach((item) => {
      const tags = (item.review && item.review.tags) || [];
      tags.forEach((tag) => {
        if (!tag) return;
        const ancestors = model.tagAncestors(tag);
        ancestors.forEach((path) => {
          const node = ensure(path);
          if (!node.itemIds.includes(item.id)) node.itemIds.push(item.id);
        });
        const leaf = ensure(tag);
        leaf.direct += 1;
      });
    });

    const list = Array.from(nodes.values());
    list.forEach((node) => {
      node.total = node.itemIds.length;
      node.children.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh"));
    });
    const top = list.filter((n) => n.depth === 1);
    top.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh"));
    return { root, nodes, list, top };
  };

  model.tagOptions = function tagOptions(items) {
    const tree = model.buildTagTree(items);
    return tree.list
      .slice()
      .sort((a, b) => b.total - a.total || a.path.localeCompare(b.path, "zh"))
      .map((n) => ({ path: n.path, name: n.name, depth: n.depth, total: n.total }));
  };

  /* ---------- items ---------- */

  model.createItem = function createItem(raw) {
    const now = new Date().toISOString();
    const url = model.safeUrl((raw && raw.url) || "");
    const likedAt = raw && raw.likedAt ? raw.likedAt : now;
    const review = (raw && raw.review) || {};
    const id = (raw && raw.id) || util.uid("itm");
    const shapeList = ["square", "wide", "tall"];
    const shape =
      raw && shapeList.includes(raw.shape)
        ? raw.shape
        : shapeList[util.hash(id) % shapeList.length];
    const item = {
      id,
      title: util.softWrap((raw && raw.title) || "") || "未命名内容",
      url,
      source: SOURCES[(raw && raw.source) || ""] ? raw.source : model.detectSource(url),
      author: util.softWrap((raw && raw.author) || ""),
      cover: String((raw && raw.cover) || ""),
      summary: util.softWrap((raw && raw.summary) || ""),
      duration: String((raw && raw.duration) || ""),
      shape,
      likedAt,
      createdAt: (raw && raw.createdAt) || now,
      updatedAt: (raw && raw.updatedAt) || now,
      review: {
        rating: util.clamp(Math.round(Number(review.rating) || 0), 0, 5),
        note: String(review.note || "").replace(/\s+$/g, ""),
        tags: model.normalizeTags(review.tags),
        reviewedAt: review.reviewedAt || null,
      },
    };
    if (!item.review.reviewedAt && (item.review.note.trim() || item.review.rating > 0)) {
      item.review.reviewedAt = item.updatedAt;
    }
    return item;
  };

  model.normalizeItem = function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const item = model.createItem(raw);
    if (!item.id) item.id = util.uid("itm");
    if (!util.toDate(item.likedAt)) item.likedAt = new Date().toISOString();
    if (!util.toDate(item.createdAt)) item.createdAt = item.likedAt;
    return item;
  };

  model.isReviewed = function isReviewed(item) {
    const r = item && item.review;
    return !!r && (r.rating > 0 || String(r.note || "").trim().length > 0);
  };

  model.hasNote = function hasNote(item) {
    return !!(item && item.review && String(item.review.note || "").trim());
  };

  /* ---------- state ---------- */

  model.defaultSettings = function defaultSettings() {
    return {
      theme: "light",
      density: "comfy",
      motion: true,
      autoSaveFolder: true,
      demoNoticeDismissed: false,
      folderName: "",
      sort: "recent",
      filter: "all",
    };
  };

  model.createState = function createState(items) {
    const now = new Date().toISOString();
    return {
      version: model.SCHEMA_VERSION,
      items: (items || []).map(model.normalizeItem).filter(Boolean),
      settings: model.defaultSettings(),
      meta: {
        createdAt: now,
        updatedAt: now,
        demo: true,
      },
    };
  };

  model.normalizeState = function normalizeState(raw) {
    if (!raw) return null;

    // allow a bare array of items
    if (Array.isArray(raw)) raw = { items: raw };

    if (typeof raw !== "object") return null;
    const hasItems = Array.isArray(raw.items);
    if (!hasItems) return null;

    const seen = new Set();
    const items = [];
    raw.items.forEach((entry) => {
      const item = model.normalizeItem(entry);
      if (!item) return;
      if (seen.has(item.id)) item.id = util.uid("itm");
      seen.add(item.id);
      items.push(item);
    });

    const defaults = model.defaultSettings();
    const settings = Object.assign({}, defaults, raw.settings || {});
    if (!["light", "dark"].includes(settings.theme)) settings.theme = "light";
    if (!["comfy", "compact"].includes(settings.density)) settings.density = "comfy";
    settings.motion = settings.motion !== false;
    settings.autoSaveFolder = settings.autoSaveFolder !== false;
    settings.demoNoticeDismissed = !!settings.demoNoticeDismissed;

    const now = new Date().toISOString();
    const meta = Object.assign(
      { createdAt: now, updatedAt: now, demo: false },
      raw.meta || {}
    );

    return {
      version: model.SCHEMA_VERSION,
      items,
      settings,
      meta,
    };
  };

  model.stats = function stats(items) {
    const total = items.length;
    let reviewed = 0;
    let notes = 0;
    let pending = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    items.forEach((item) => {
      const r = item.review || {};
      if (model.isReviewed(item)) reviewed += 1;
      else pending += 1;
      if (String(r.note || "").trim()) notes += 1;
      if (r.rating > 0) {
        ratingSum += r.rating;
        ratingCount += 1;
      }
    });
    const tree = model.buildTagTree(items);
    return {
      total,
      reviewed,
      notes,
      pending,
      tags: tree.list.length,
      topTags: tree.top.length,
      avgRating: ratingCount ? ratingSum / ratingCount : 0,
      tree,
    };
  };

  model.sanitizeFilename = function sanitizeFilename(name) {
    return String(name || "思之流")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  };
})();
