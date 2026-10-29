/* ==========================================================================
   Feed view — the review stream
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  const FILTERS = [
    { id: "all", label: "全部" },
    { id: "pending", label: "待回看" },
    { id: "noted", label: "有感想" },
    { id: "loved", label: "值得再看" },
  ];

  views.feed = function feedView(ctx) {
    const store = ctx.store;
    const settings = store.settings();
    const uiState = {
      query: "",
      filter: "all",
      sort: settings.sort || "recent",
      tag: "",
    };

    const root = util.el("div", { class: "page view-enter feed-page" });

    /* ---------------- header ---------------- */

    const head = util.el("header", { class: "page-head" });
    const eyebrow = util.el("div", {
      class: "eyebrow",
      text: "STREAM OF THOUGHT · " + util.todayLabel(),
    });
    const headGrid = util.el("div", { class: "head-grid" });
    const title = util.el("h1", { class: "head-title" }, [
      util.el("span", { text: "回看" }),
      util.el("span", { class: "title-en", text: "review" }),
      util.el("span", { class: "title-count", text: "" }),
    ]);
    const titleCount = title.querySelector(".title-count");
    const addBtn = util.el("button", {
      class: "btn btn-primary",
      attrs: { type: "button" },
      html: util.icon("plus", 15) + "<span>收下一条</span>",
      on: { click: () => ctx.app.openCapture() },
    });
    const focusBtn = util.el("button", {
      class: "btn btn-ghost",
      attrs: { type: "button" },
      html: util.icon("eye", 15) + "<span>沉浸回顾</span>",
      on: { click: () => ctx.app.openFocus() },
    });

    headGrid.appendChild(title);
    headGrid.appendChild(
      util.el("div", { class: "head-side" }, [
        util.el("p", {
          class: "lede",
          text:
            "大范围浏览之后，停一下。给看过的东西一次评价、一句总结，把被信息流带走的注意力，慢慢拿回来。",
        }),
        util.el("div", { class: "head-actions" }, [addBtn, focusBtn]),
      ])
    );

    const statRow = util.el("div", { class: "stat-row" });
    const statRefs = {};
    [
      { key: "total", label: "条收藏", accent: false },
      { key: "notes", label: "条写下想法", accent: false },
      { key: "pending", label: "条待回看", accent: true },
      { key: "topTags", label: "组标签", accent: false },
    ].forEach((entry) => {
      const num = util.el("span", { class: "stat-num", text: "0" });
      const stat = util.el(
        "div",
        { class: "stat" + (entry.accent ? " is-accent" : "") },
        [num, util.el("span", { class: "stat-label", text: entry.label })]
      );
      statRefs[entry.key] = num;
      statRow.appendChild(stat);
      statRow.appendChild(util.el("span", { class: "stat-sep" }));
    });
    statRow.lastChild.remove();

    head.appendChild(eyebrow);
    head.appendChild(headGrid);
    head.appendChild(statRow);

    /* ---------------- notice + strip ---------------- */

    const notice = util.el("div", { class: "notice" });
    const reviewStrip = util.el("div", { class: "review-strip" });

    function renderNotice() {
      const state = store.state;
      util.clear(notice);
      if (!state.meta.demo || state.settings.demoNoticeDismissed) {
        notice.style.display = "none";
        return;
      }
      notice.style.display = "";
      notice.appendChild(util.el("span", { class: "notice-mark", text: "思" }));
      notice.appendChild(
        util.el("div", {
          class: "notice-text",
          html:
            "<strong>这是一个带示例内容的本地空间。</strong>看看它如何运转，然后换成你自己的。",
        })
      );
      const actions = util.el("div", { class: "notice-actions" }, [
        util.el("button", {
          class: "btn btn-quiet",
          attrs: { type: "button" },
          text: "清空示例",
          on: {
            click: async () => {
              const ok = await SZL.ui.confirm({
                eyebrow: "开始之前",
                title: "清空示例内容？",
                message: "会移除这 16 条示例，之后你收下的内容都会保存在本机。此操作不可撤销。",
                confirmText: "清空并开始",
                cancelText: "再想想",
              });
              if (!ok) return;
              store.clearAll();
              SZL.toast("示例已清空，收下你想回顾的第一条吧。", { icon: "spark" });
              ctx.app.openCapture();
            },
          },
        }),
        util.el("button", {
          class: "notice-close",
          attrs: { type: "button", "aria-label": "关闭提示" },
          html: util.icon("close", 11),
          on: { click: () => { store.markDemoNotice(); renderNotice(); } },
        }),
      ]);
      notice.appendChild(actions);
    }

    function renderStrip() {
      const stats = store.stats();
      util.clear(reviewStrip);
      if (!stats.pending) {
        reviewStrip.style.display = "none";
        return;
      }
      reviewStrip.style.display = "";
      reviewStrip.appendChild(util.el("span", { class: "strip-label", text: "今日回看" }));
      reviewStrip.appendChild(
        util.el("div", {
          class: "strip-text",
          html:
            "还有 <strong>" + stats.pending + " 条</strong>收藏没有写下任何评价。随机挑一条，花一分钟。",
        })
      );
      reviewStrip.appendChild(
        util.el("button", {
          class: "strip-action",
          attrs: { type: "button" },
          text: "现在就回看 →",
          on: {
            click: () => {
              const pool = store.unreviewed();
              const picked = store.randomItem(pool);
              if (picked) ctx.app.openFocus(picked.id, pool);
            },
          },
        })
      );
    }

    /* ---------------- toolbar ---------------- */

    const toolbar = util.el("div", { class: "toolbar" });
    const filters = util.el("div", { class: "filters", attrs: { role: "tablist" } });
    const filterChips = {};
    FILTERS.forEach((filter) => {
      const chip = util.el("button", {
        class: "chip" + (uiState.filter === filter.id ? " is-on" : ""),
        attrs: { type: "button", role: "tab", "aria-selected": String(uiState.filter === filter.id) },
        on: {
          click: () => {
            uiState.filter = filter.id;
            Object.keys(filterChips).forEach((id) => {
              filterChips[id].el.classList.toggle("is-on", id === filter.id);
              filterChips[id].el.setAttribute("aria-selected", String(id === filter.id));
            });
            renderList();
            updateMeta();
          },
        },
      }, [
        util.el("span", { text: filter.label }),
        util.el("span", { class: "chip-count", text: "0" }),
      ]);
      filterChips[filter.id] = { el: chip, count: chip.querySelector(".chip-count") };
      filters.appendChild(chip);
    });

    const searchWrap = util.el("label", { class: "search" });
    searchWrap.innerHTML = util.icon("search", 14);
    const searchInput = util.el("input", {
      attrs: {
        type: "search",
        placeholder: "搜标题、感想、标签",
        "aria-label": "搜索标题、感想与标签",
        spellcheck: "false",
      },
    });
    const clearBtn = util.el("button", {
      class: "search-clear",
      attrs: { type: "button", "aria-label": "清除搜索" },
      html: util.icon("close", 10),
      style: { display: "none" },
      on: {
        click: (event) => {
          event.preventDefault();
          searchInput.value = "";
          uiState.query = "";
          clearBtn.style.display = "none";
          updateSearchHint();
          renderList();
          updateMeta();
          searchInput.focus();
        },
      },
    });
    const kbd = util.el("kbd", { text: util.modKey() + " K" });
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(clearBtn);
    searchWrap.appendChild(kbd);

    const sortSelect = util.el("select", {
      class: "sort-select",
      attrs: { "aria-label": "排序方式" },
      on: {
        change: () => {
          uiState.sort = sortSelect.value;
          renderList();
          updateMeta();
        },
      },
    }, [
      util.el("option", { value: "recent", text: "最近收藏" }),
      util.el("option", { value: "oldest", text: "最早收藏" }),
      util.el("option", { value: "rating", text: "评分最高" }),
      util.el("option", { value: "reviewed", text: "最近回看" }),
    ]);
    sortSelect.value = uiState.sort;

    const randomBtn = util.el("button", {
      class: "icon-btn",
      attrs: { type: "button", title: "随机回看一条", "aria-label": "随机回看一条" },
      html: util.icon("shuffle", 15),
      on: {
        click: () => {
          const picked = store.randomItem(store.items());
          if (picked) ctx.app.openFocus(picked.id);
          else SZL.toast("还没有可以回看的内容。");
        },
      },
    });

    const toolbarRight = util.el("div", { class: "toolbar-right" }, [
      searchWrap,
      sortSelect,
      randomBtn,
    ]);
    toolbar.appendChild(filters);
    toolbar.appendChild(toolbarRight);

    const toolbarObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              toolbar.classList.toggle("is-stuck", !entries[0].isIntersecting);
            },
            { rootMargin: "-1px 0px 0px 0px", threshold: 0 }
          )
        : null;
    const sentinel = util.el("div", { style: { height: "1px" } });

    const gridMeta = util.el("div", { class: "grid-meta" });
    const gridMetaLeft = util.el("span", { text: "" });
    const gridMetaRight = util.el("span", { text: "" });
    gridMeta.appendChild(gridMetaLeft);
    gridMeta.appendChild(gridMetaRight);

    const grid = util.el("section", {
      class: "feed-grid",
      dataset: { density: settings.density },
      attrs: { "aria-label": "回顾卡片列表" },
    });

    const footer = util.el("footer", { class: "page-foot" }, [
      util.el("span", {
        class: "philosophy",
        text: "不断评价、回顾、思考，打断被信息流劫持的大脑。",
      }),
      util.el("span", { class: "foot-mono", text: "SIZILIU · LOCAL FIRST · v0.1" }),
    ]);

    root.appendChild(head);
    root.appendChild(notice);
    root.appendChild(reviewStrip);
    root.appendChild(sentinel);
    root.appendChild(toolbar);
    root.appendChild(gridMeta);
    root.appendChild(grid);
    root.appendChild(footer);

    /* ---------------- search ---------------- */

    function updateSearchHint() {
      clearBtn.style.display = searchInput.value ? "" : "none";
    }

    const applyQuery = util.debounce(() => {
      uiState.query = searchInput.value.trim();
      clearBtn.style.display = uiState.query ? "" : "none";
      renderList();
      updateMeta();
    }, 160);

    searchInput.addEventListener("input", applyQuery);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        searchInput.value = "";
        uiState.query = "";
        applyQuery.cancel();
        clearBtn.style.display = "none";
        renderList();
        updateMeta();
        searchInput.blur();
      }
    });

    /* ---------------- data & cards ---------------- */

    const cards = new Map();
    let currentVisible = [];
    let layoutFrame = 0;
    let resizeObserver = null;
    let toggleBefore = null;
    let emptyState = null;

    function makeCard(item, index) {
      return views.createCard(item, {
        index,
        store,
        onBeforeToggle: () => {
          toggleBefore = SZL.flip.capture(grid, ".card");
        },
        onToggle: (cardEl, open) => {
          handleToggle(cardEl, open, toggleBefore);
          toggleBefore = null;
        },
        onEdit: (target) => ctx.app.openCapture({ item: target }),
        onDelete: (target) => ctx.app.deleteItem(target),
        onTagClick: (tag) => ctx.app.openTag(tag),
      });
    }

    function ensureCard(item, index) {
      let api = cards.get(item.id);
      if (!api) {
        api = makeCard(item, index);
        cards.set(item.id, api);
        if (resizeObserver) resizeObserver.observe(api.el);
      } else {
        api.sync();
      }
      return api;
    }

    function currentList() {
      return SZL.search.filterItems(store.items(), uiState);
    }

    function resetFilters() {
      uiState.query = "";
      uiState.filter = "all";
      searchInput.value = "";
      clearBtn.style.display = "none";
      Object.keys(filterChips).forEach((id) =>
        filterChips[id].el.classList.toggle("is-on", id === "all")
      );
      renderList();
      updateMeta();
    }

    function buildEmptyState() {
      const noneAtAll = store.items().length === 0;
      const node = util.el("div", { class: "feed-empty" });
      node.innerHTML =
        '<svg viewBox="0 0 120 60" aria-hidden="true"><path d="M6 42c12-16 22 6 34-4s18 10 30-2 16 6 26-8"/><path d="M6 50c12-16 22 6 34-4s18 10 30-2 16 6 26-8" opacity=".35"/></svg>';
      node.appendChild(
        util.el("h3", {
          text: noneAtAll ? "这里还没有内容" : "没有找到相符的回顾",
        })
      );
      node.appendChild(
        util.el("p", {
          text: noneAtAll
            ? "从一条让你停下来的内容开始。一个链接、一句当时的想法，就够了。"
            : "试试别的关键词，或者回到全部，看看之前留下过什么。",
        })
      );
      if (noneAtAll) {
        node.appendChild(
          util.el("button", {
            class: "btn btn-primary",
            attrs: { type: "button" },
            html: util.icon("plus", 14) + "<span>收下第一条</span>",
            on: { click: () => ctx.app.openCapture() },
          })
        );
        node.appendChild(
          util.el("button", {
            class: "btn btn-ghost btn-sm",
            attrs: { type: "button" },
            text: "载入示例看看",
            on: {
              click: () => {
                store.resetDemo();
                SZL.toast("示例已载入。", { icon: "spark" });
              },
            },
          })
        );
      } else {
        node.appendChild(
          util.el("button", {
            class: "btn btn-ghost btn-sm",
            attrs: { type: "button" },
            text: "清除筛选",
            on: { click: resetFilters },
          })
        );
      }
      return node;
    }

    function renderList(options) {
      const opts = options || {};
      const list = currentList();
      const before = opts.flip === false ? null : SZL.flip.capture(grid, ".card");
      const keep = new Set();
      const fragment = document.createDocumentFragment();

      list.forEach((item, index) => {
        const api = ensureCard(item, index);
        keep.add(item.id);
        fragment.appendChild(api.el);
      });

      cards.forEach((api, id) => {
        if (!keep.has(id)) {
          api.el.remove();
        }
      });

      grid.appendChild(fragment);
      if (!list.length) {
        emptyState = buildEmptyState();
        grid.appendChild(emptyState);
      } else if (emptyState) {
        emptyState.remove();
        emptyState = null;
      }
      grid.classList.toggle("is-empty", !list.length);
      grid.classList.toggle("is-sparse", list.length > 0 && list.length < 3);
      currentVisible = list.map((item) => cards.get(item.id)).filter(Boolean);
      layoutMasonry();
      if (before) {
        requestAnimationFrame(() => {
          layoutMasonry();
          SZL.flip.play(before);
        });
      }
      if (opts.revealId) revealCard(opts.revealId, opts.open);
    }

    function handleToggle(cardEl, open, before) {
      requestAnimationFrame(() => {
        layoutMasonry();
        if (before) SZL.flip.play(before, { duration: 420 });
        if (open) {
          setTimeout(() => {
            const rect = cardEl.getBoundingClientRect();
            if (rect.top < 74 || rect.bottom > window.innerHeight - 12) {
              window.scrollTo({
                top: Math.max(0, window.scrollY + rect.top - 84),
                behavior: "smooth",
              });
            }
          }, 80);
        }
      });
    }

    function layoutMasonry() {
      if (layoutFrame) return;
      const run = () => {
        layoutFrame = 0;
        const style = getComputedStyle(grid);
        if (style.display === "block") {
          currentVisible.forEach((api) => {
            api.el.style.gridRowEnd = "";
          });
          return;
        }
        const row = parseFloat(style.gridAutoRows) || 4;
        const gap = parseFloat(style.rowGap) || 0;
        currentVisible.forEach((api) => {
          const height = api.el.getBoundingClientRect().height;
          const span = Math.max(1, Math.ceil((height + gap) / (row + gap)));
          api.el.style.gridRowEnd = "span " + span;
        });
      };
      layoutFrame = requestAnimationFrame(run);
    }

    function updateStats() {
      const stats = store.stats();
      titleCount.textContent = String(stats.total).padStart(2, "0");
      Object.keys(statRefs).forEach((key) => {
        statRefs[key].textContent = stats[key];
      });
      filterChips.all.count.textContent = stats.total;
      filterChips.pending.count.textContent = stats.pending;
      filterChips.noted.count.textContent = stats.notes;
      filterChips.loved.count.textContent = store.items().filter(
        (item) => item.review.rating >= 4
      ).length;
      focusBtn.disabled = stats.total === 0;
      randomBtn.disabled = stats.total === 0;
      renderStrip();
    }

    function updateMeta() {
      const stats = store.stats();
      const list = currentVisible.map((api) => api.item);
      const bits = [];
      if (uiState.query) bits.push("“" + uiState.query + "”");
      if (uiState.filter !== "all") {
        const filter = FILTERS.find((f) => f.id === uiState.filter);
        if (filter) bits.push(filter.label);
      }
      gridMetaLeft.textContent = bits.length
        ? "筛选 · " + bits.join(" · ") + " · " + list.length + " 条"
        : "全部 " + stats.total + " 条 · 按" + (sortSelect.options[sortSelect.selectedIndex] || {}).text;
      const lastReviewed = store
        .items()
        .map((item) => item.review.reviewedAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];
      gridMetaRight.textContent = lastReviewed
        ? "最近回看 · " + util.formatRelative(lastReviewed)
        : stats.total
        ? "还没有写下第一条想法"
        : "还没有收下任何内容";
    }

    function revealCard(id, open) {
      const api = cards.get(id);
      if (!api) return;
      // make sure the card can be seen
      let needsRerender = false;
      if (!currentVisible.includes(api)) {
        if (uiState.query) {
          searchInput.value = "";
          uiState.query = "";
          clearBtn.style.display = "none";
          needsRerender = true;
        }
        if (uiState.filter !== "all") {
          uiState.filter = "all";
          Object.keys(filterChips).forEach((key) =>
            filterChips[key].el.classList.toggle("is-on", key === "all")
          );
          needsRerender = true;
        }
        if (needsRerender) {
          renderList({ flip: false });
          updateMeta();
        }
      }
      const target = cards.get(id);
      if (!target) return;
      if (open) target.expand();
      requestAnimationFrame(() => {
        layoutMasonry();
        target.el.scrollIntoView({ behavior: "smooth", block: "center" });
        target.flash();
      });
    }

    /* ---------------- boot ---------------- */

    renderNotice();
    updateStats();
    updateMeta();
    renderList({ flip: false });
    updateMeta();
    updateSearchHint();
    if (sentinel.isConnected && toolbarObserver) toolbarObserver.observe(sentinel);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => layoutMasonry());
      cards.forEach((api) => resizeObserver.observe(api.el));
    }
    const onResize = util.debounce(() => layoutMasonry(), 120);
    window.addEventListener("resize", onResize);

    function onStoreChange(payload) {
      const reason = payload && payload.reason;
      if (["add", "add-many", "delete", "restore", "import", "reset", "clear"].includes(reason)) {
        renderNotice();
        updateStats();
        renderList();
        updateMeta();
        return;
      }
      if (reason === "update") {
        const api = cards.get(payload.id);
        if (api) api.sync();
        renderNotice();
        updateStats();
        updateMeta();
        layoutMasonry();
        return;
      }
      if (reason === "review") {
        updateStats();
        updateMeta();
        if (payload.id) {
          const api = cards.get(payload.id);
          if (api && !api.isOpen()) api.sync();
        }
        layoutMasonry();
        return;
      }
      if (reason === "settings") {
        grid.dataset.density = store.settings().density;
        updateStats();
        renderNotice();
        layoutMasonry();
      }
    }

    const off = store.on("change", onStoreChange);

    searchInput.addEventListener("focus", () => {
      if (!searchInput.value) updateSearchHint();
    });

    // "/" focuses search
    const onKey = (event) => {
      if (event.defaultPrevented) return;
      const tag = (event.target && event.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (event.target && event.target.isContentEditable)) {
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInput.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return {
      el: root,
      mount() {
        layoutMasonry();
        updateStats();
        updateMeta();
        renderNotice();
      },
      destroy() {
        off();
        if (resizeObserver) resizeObserver.disconnect();
        if (toolbarObserver) toolbarObserver.disconnect();
        window.removeEventListener("resize", onResize);
        document.removeEventListener("keydown", onKey);
        if (layoutFrame) cancelAnimationFrame(layoutFrame);
      },
      reveal: revealCard,
      setFilter(id) {
        if (!FILTERS.some((f) => f.id === id)) return;
        uiState.filter = id;
        Object.keys(filterChips).forEach((key) => {
          const on = key === id;
          filterChips[key].el.classList.toggle("is-on", on);
          filterChips[key].el.setAttribute("aria-selected", String(on));
        });
        renderList();
        updateMeta();
      },
      refresh() {
        updateStats();
        renderList();
        updateMeta();
      },
      openSearch() {
        searchInput.focus();
        searchInput.select();
      },
    };
  };
})();
