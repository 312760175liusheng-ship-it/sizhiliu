/* ==========================================================================
   Search, filter, sort — pure functions over items
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const search = (SZL.search = {});
  const model = SZL.model;

  function terms(query) {
    return String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function fieldScore(value, term, weight) {
    if (!value) return 0;
    const text = String(value).toLowerCase();
    if (!text.includes(term)) return 0;
    // earlier match and exact-ish matches score a little higher
    const at = text.indexOf(term);
    return weight + (at === 0 ? 2 : 0) + (text === term ? 3 : 0);
  }

  search.scoreItem = function scoreItem(item, queryTerms) {
    if (!queryTerms.length) return 1;
    const review = item.review || {};
    const tags = (review.tags || []).join(" ");
    const sourceLabel = model.sourceMeta(item.source).label;
    let total = 0;

    for (let i = 0; i < queryTerms.length; i++) {
      const term = queryTerms[i];
      const score =
        fieldScore(item.title, term, 8) +
        fieldScore(item.author, term, 3) +
        fieldScore(item.summary, term, 3) +
        fieldScore(review.note, term, 5) +
        fieldScore(tags, term, 4) +
        fieldScore(sourceLabel, term, 1);
      if (!score) return 0;
      total += score;
    }
    return total;
  };

  search.filterItems = function filterItems(items, options) {
    const opts = options || {};
    const queryTerms = terms(opts.query);
    const filter = opts.filter || "all";
    const tag = opts.tag || "";

    let list = (items || []).filter((item) => {
      if (filter === "pending" && model.isReviewed(item)) return false;
      if (filter === "reviewed" && !model.isReviewed(item)) return false;
      if (filter === "noted" && !model.hasNote(item)) return false;
      if (filter === "loved" && !(item.review && item.review.rating >= 4)) return false;
      if (tag) {
        const tags = item.review.tags || [];
        const inTag = tags.some((t) => t === tag || t.startsWith(tag + "/"));
        if (!inTag) return false;
      }
      if (queryTerms.length && !search.scoreItem(item, queryTerms)) return false;
      return true;
    });

    list.sort(function (a, b) {
      switch (opts.sort) {
        case "oldest":
          return new Date(a.likedAt) - new Date(b.likedAt);
        case "rating":
          return (
            (b.review.rating || 0) - (a.review.rating || 0) ||
            new Date(b.likedAt) - new Date(a.likedAt)
          );
        case "reviewed":
          return (
            new Date(b.review.reviewedAt || b.updatedAt) -
            new Date(a.review.reviewedAt || a.updatedAt)
          );
        case "recent":
        default:
          return new Date(b.likedAt) - new Date(a.likedAt);
      }
    });

    return list;
  };

  search.tagNotes = function tagNotes(items, path) {
    return (items || [])
      .filter((item) =>
        (item.review.tags || []).some((tag) => tag === path || tag.startsWith(path + "/"))
      )
      .filter((item) => item.review.note && item.review.note.trim())
      .sort(
        (a, b) =>
          new Date(b.review.reviewedAt || b.likedAt) -
          new Date(a.review.reviewedAt || a.likedAt)
      );
  };

  search.suggestTags = function suggestTags(options, query, limit) {
    const q = String(query || "").toLowerCase().trim();
    const list = (options || []).filter((tag) => !q || tag.path.toLowerCase().includes(q));
    return list.slice(0, limit || 6);
  };

  /**
   * Palette results: items, tags, pages.
   */
  search.palette = function palette(state, query) {
    const q = String(query || "").trim();
    const queryTerms = terms(q);
    const items = state.items
      .map((item) => ({ item, score: search.scoreItem(item, queryTerms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.item.likedAt) - new Date(a.item.likedAt))
      .slice(0, 6)
      .map((entry) => entry.item);

    const tree = model.buildTagTree(state.items);
    const tags = tree.list
      .filter((node) => !q || node.path.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const PAGES = [
      { path: "feed", title: "回看", hint: "信息流", route: "#/feed" },
      { path: "tags", title: "标签", hint: "想法的坐标", route: "#/tags" },
      { path: "tree", title: "记忆树", hint: "看见自己的形状", route: "#/tree" },
      { path: "settings", title: "设置", hint: "数据与外观", route: "#/settings" },
    ];
    const pages = PAGES.filter(
      (page) =>
        !q ||
        page.title.includes(q) ||
        page.hint.includes(q) ||
        page.path.includes(q.toLowerCase())
    );

    return { items, tags, pages };
  };
})();
