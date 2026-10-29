/* ==========================================================================
   Command palette (⌘K)
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  let current = null;

  views.openCommand = function openCommand(ctx) {
    if (current) {
      current.close();
      return current;
    }
    const store = ctx.store;
    const app = ctx.app;
    const root = document.getElementById("overlay-root");
    const lastFocus = document.activeElement;
    let closed = false;
    let results = [];
    let active = 0;

    const overlay = util.el("div", { class: "overlay cmd-overlay" });
    const backdrop = util.el("div", { class: "overlay-backdrop" });
    const panel = util.el("div", {
      class: "cmd",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "搜索与跳转" },
    });

    const searchIcon = util.el("span", { class: "cmd-search-icon", html: util.icon("search", 16) });
    const input = util.el("input", {
      class: "cmd-input",
      attrs: {
        type: "text",
        placeholder: "搜索标题、感想、标签，或输入“收下”…",
        "aria-label": "搜索与跳转",
        autocomplete: "off",
        spellcheck: "false",
      },
    });
    const escHint = util.el("kbd", { text: "ESC" });
    const head = util.el("div", { class: "cmd-head" }, [searchIcon, input, escHint]);
    const body = util.el("div", { class: "cmd-body", attrs: { role: "listbox" } });
    const foot = util.el("div", { class: "cmd-foot" }, [
      util.el("span", { html: "<kbd>↑</kbd> <kbd>↓</kbd> 选择" }),
      util.el("span", { html: "<kbd>↵</kbd> 打开" }),
      util.el("span", { html: "<kbd>esc</kbd> 关闭" }),
      util.el("span", { class: "cmd-foot-brand", text: "思之流" }),
    ]);
    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    root.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";

    function actionsForQuery(query) {
      const q = query.toLowerCase();
      const list = [
        {
          type: "action",
          title: "收下一条",
          note: "粘贴链接，添加新的回顾",
          icon: "plus",
          run: () => {
            close();
            app.openCapture();
          },
        },
        {
          type: "action",
          title: "沉浸回顾",
          note: "随机抽一条，安静地想一想",
          icon: "eye",
          run: () => {
            close();
            app.openFocus();
          },
        },
        {
          type: "action",
          title: "只看待回看",
          note: "还有 " + store.stats().pending + " 条没有评价",
          icon: "clock",
          run: () => {
            close();
            if (app.route === "feed" && app._activeView && app._activeView.setFilter) {
              app._activeView.setFilter("pending");
            } else {
              app.navigate("feed");
              requestAnimationFrame(() => {
                if (app._activeView && app._activeView.setFilter) {
                  app._activeView.setFilter("pending");
                }
              });
            }
          },
        },
        {
          type: "action",
          title: "切换深浅色",
          note: "当前：" + (store.settings().theme === "dark" ? "深色" : "浅色"),
          icon: store.settings().theme === "dark" ? "spark" : "leaf",
          run: () => {
            close();
            const next = store.settings().theme === "dark" ? "light" : "dark";
            store.setSettings({ theme: next });
            if (SZL.app) SZL.app.saveIndicator("saved");
          },
        },
      ];
      if (!q) return list.slice(0, 3);
      return list.filter(
        (action) =>
          action.title.toLowerCase().includes(q) || action.note.toLowerCase().includes(q)
      );
    }

    function buildResults(query) {
      const q = String(query || "").trim();
      const palette = SZL.search.palette(store.state, q);
      const groups = [];

      const actions = actionsForQuery(q);
      if (actions.length) {
        groups.push({ label: q ? "动作" : "快速开始", items: actions });
      }

      if (palette.pages.length && !q) {
        groups.push({
          label: "跳转",
          items: palette.pages.map((page) => ({
            type: "page",
            title: page.title,
            note: page.hint,
            icon:
              page.path === "feed"
                ? "grid"
                : page.path === "tree"
                ? "leaf"
                : page.path === "settings"
                ? "sliders"
                : "hash",
            run: () => {
              close();
              app.navigate(page.path);
            },
          })),
        });
      }

      if (palette.items.length) {
        groups.push({
          label: q ? "内容" : "最近收下",
          items: palette.items.map((item) => ({
            type: "item",
            title: item.title,
            note: item.review.note
              ? util.truncate(item.review.note, 54)
              : item.summary || model.sourceMeta(item.source).label,
            source: item.source,
            run: () => {
              close();
              app.openItem(item.id);
            },
          })),
        });
      }

      if (palette.tags.length) {
        groups.push({
          label: "标签",
          items: palette.tags.map((node) => ({
            type: "tag",
            title: node.path,
            note: node.total + " 条内容 · " + node.children.length + " 个子标签",
            icon: "hash",
            run: () => {
              close();
              app.openTag(node.path);
            },
          })),
        });
      }

      // when searching, expose pages that match
      if (q && palette.pages.length) {
        groups.push({
          label: "页面",
          items: palette.pages.map((page) => ({
            type: "page",
            title: page.title,
            note: page.hint,
            icon:
              page.path === "feed"
                ? "grid"
                : page.path === "tree"
                ? "leaf"
                : page.path === "settings"
                ? "sliders"
                : "hash",
            run: () => {
              close();
              app.navigate(page.path);
            },
          })),
        });
      }

      return groups;
    }

    function setActive(index) {
      const nodes = Array.from(body.querySelectorAll(".cmd-item"));
      if (!nodes.length) return;
      active = (index + nodes.length) % nodes.length;
      nodes.forEach((node, i) => {
        node.classList.toggle("is-active", i === active);
        node.setAttribute("aria-selected", String(i === active));
      });
      nodes[active].scrollIntoView({ block: "nearest" });
    }

    function render() {
      const groups = buildResults(input.value);
      util.clear(body);
      results = [];
      if (!groups.length) {
        body.appendChild(
          util.el("div", { class: "cmd-empty" }, [
            util.el("p", { text: "没有找到相关的内容" }),
            util.el("span", { text: "试试更短的关键词，或者换个标签。" }),
          ])
        );
        return;
      }
      groups.forEach((group) => {
        body.appendChild(util.el("div", { class: "cmd-group-label", text: group.label }));
        group.items.forEach((entry) => {
          const index = results.length;
          results.push(entry);
          const item = util.el("button", {
            class: "cmd-item",
            attrs: { type: "button", role: "option", "aria-selected": "false" },
            on: {
              click: () => entry.run(),
              mouseenter: () => setActive(index),
            },
          });
          if (entry.type === "item") {
            const meta = model.sourceMeta(entry.source);
            const icon = SZL.brand ? SZL.brand.icon(entry.source, 13) : "";
            item.appendChild(
              util.el("span", {
                class: "cmd-icon cmd-icon-source",
                style: { "--src-color": meta.color },
                attrs: { title: meta.label },
                html: icon || util.escapeHTML(meta.label.slice(0, 2)),
              })
            );
          } else {
            item.appendChild(
              util.el("span", { class: "cmd-icon", html: util.icon(entry.icon || "hash", 13) })
            );
          }
          item.appendChild(
            util.el("span", { class: "cmd-main" }, [
              util.el("span", { class: "cmd-title", text: entry.title }),
              entry.note ? util.el("span", { class: "cmd-note", text: entry.note }) : null,
            ])
          );
          if (entry.type === "item") {
            item.appendChild(
              util.el("span", { class: "cmd-hint", text: "打开" })
            );
          }
          body.appendChild(item);
        });
      });
      active = 0;
      setActive(0);
    }

    function close() {
      if (closed) return;
      closed = true;
      current = null;
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = "";
      overlay.classList.add("is-closing");
      setTimeout(() => {
        overlay.remove();
        if (lastFocus && lastFocus.focus) {
          try {
            lastFocus.focus({ preventScroll: true });
          } catch (err) {
            /* ignore */
          }
        }
      }, 180);
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive(active + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(active - 1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const entry = results[active];
        if (entry) entry.run();
      }
    }

    input.addEventListener("input", render);
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("click", close);

    const controller = { close, panel };
    current = controller;

    util.nextFrame(() => {
      overlay.classList.add("is-open");
      input.focus({ preventScroll: true });
    });
    render();

    return controller;
  };
})();
