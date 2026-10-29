/* ==========================================================================
   App: boot, routing, shell interactions, cross-view actions
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;

  const ROUTES = ["feed", "tags", "tree", "settings"];
  const TITLES = {
    feed: "回看 · 思之流",
    tags: "标签 · 思之流",
    tree: "记忆树 · 思之流",
    settings: "设置 · 思之流",
  };

  const app = {
    view: null,
    route: "",
    tagSelection: "",
    _activeView: null,
  };

  function setRail(route) {
    util.qsa(".rail-link").forEach((link) => {
      const active = link.dataset.route === route;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const sun = document.querySelector('[data-theme-icon="sun"]');
    const moon = document.querySelector('[data-theme-icon="moon"]');
    if (sun && moon) {
      sun.hidden = theme === "dark";
      moon.hidden = theme !== "dark";
    }
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-label", theme === "dark" ? "切换到浅色" : "切换到深色");
      btn.title = theme === "dark" ? "切换到浅色" : "切换到深色";
    }
  }

  function applyMotion(on) {
    document.documentElement.dataset.motion = on ? "on" : "off";
  }

  function routeFromHash() {
    const hash = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return ROUTES.includes(hash) ? hash : "feed";
  }

  function destroyView() {
    if (app._activeView && app._activeView.destroy) {
      try {
        app._activeView.destroy();
      } catch (err) {
        console.error("[思之流] 视图清理失败", err);
      }
    }
    app._activeView = null;
  }

  function renderRoute() {
    const route = routeFromHash();
    app.route = route;
    setRail(route);
    document.title = TITLES[route] || TITLES.feed;
    destroyView();
    if (SZL.ui && SZL.ui.closeDrawer) SZL.ui.closeDrawer();
    if (SZL.ui && SZL.ui.closeActive) SZL.ui.closeActive();
    document.querySelectorAll(".focus-overlay, .cmd-overlay").forEach((node) => node.remove());
    document.documentElement.style.overflow = "";

    const main = document.getElementById("view");
    util.clear(main);

    const ctx = { store: app.store, app };
    let view = null;
    try {
      if (route === "feed" && SZL.views.feed) view = SZL.views.feed(ctx);
      else if (route === "tags" && SZL.views.tags) view = SZL.views.tags(ctx);
      else if (route === "tree" && SZL.views.tree) view = SZL.views.tree(ctx);
      else if (route === "settings" && SZL.views.settings) view = SZL.views.settings(ctx);
      if (!view) view = placeholder(route);
    } catch (err) {
      console.error("[思之流] 页面渲染失败", err);
      view = errorView(err);
    }

    if (view && view.el) {
      view.el.classList.add("view-enter");
      main.appendChild(view.el);
      if (typeof view.mount === "function") {
        try {
          view.mount();
        } catch (err) {
          console.error("[思之流] 页面挂载失败", err);
        }
      }
    }
    app._activeView = view;
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function placeholder(route) {
    return {
      el: util.el("div", { class: "page" }, [
        util.el("div", { class: "page-head" }, [
          util.el("div", { class: "eyebrow", text: "COMING SOON" }),
          util.el("h1", { class: "head-title", text: route }),
          util.el("p", { class: "lede", text: "这个页面还没有准备好。" }),
        ]),
      ]),
    };
  }

  function errorView(err) {
    return {
      el: util.el("div", { class: "page" }, [
        util.el("div", { class: "eyebrow", text: "SOMETHING WENT WRONG" }),
        util.el("h1", { class: "head-title", text: "这里出了点问题" }),
        util.el("p", {
          class: "lede",
          text: String((err && err.message) || err || "未知错误"),
        }),
        util.el("button", {
          class: "btn btn-ghost",
          attrs: { type: "button", style: "margin-top:20px" },
          text: "重新载入",
          on: { click: () => location.reload() },
        }),
      ]),
    };
  }

  app.navigate = function navigate(route) {
    if (!ROUTES.includes(route)) route = "feed";
    if (location.hash === "#/" + route) renderRoute();
    else location.hash = "#/" + route;
  };

  app.openCapture = function openCapture(options) {
    if (SZL.views.openCapture) {
      SZL.views.openCapture({
        store: app.store,
        app,
        item: options && options.item,
      });
    }
  };

  app.openFocus = function openFocus(id, pool) {
    if (SZL.views.openFocus) {
      SZL.views.openFocus({ store: app.store, app, startId: id, pool });
    }
  };

  app.openTag = function openTag(tag) {
    app.tagSelection = tag || "";
    if (app.route === "tags" && app._activeView && app._activeView.selectTag) {
      app._activeView.selectTag(app.tagSelection);
    } else {
      app.navigate("tags");
    }
  };

  app.revealItem = function revealItem(id, open) {
    const reveal = () => {
      if (app._activeView && app._activeView.reveal) {
        app._activeView.reveal(id, !!open);
      }
    };
    if (app.route === "feed") {
      reveal();
    } else {
      app.navigate("feed");
      requestAnimationFrame(reveal);
    }
  };

  app.openItem = function openItem(id) {
    app.revealItem(id, true);
  };

  app.deleteItem = async function deleteItem(item) {
    if (!item) return;
    const ok = await SZL.ui.confirm({
      eyebrow: "移出回顾",
      title: "把这条内容移出回顾？",
      message:
        "“" + util.truncate(item.title, 34) + "” 以及它下面的评价、感想和标签都会被移除。",
      confirmText: "移出",
      cancelText: "留着",
      danger: true,
    });
    if (!ok) return;
    const removed = app.store.removeItem(item.id);
    if (!removed) return;
    SZL.toast("已移出回顾。", {
      icon: "trash",
      action: {
        label: "撤销",
        onClick: () => {
          app.store.restoreItem(removed.item, removed.index);
          SZL.toast("已放回。", { icon: "check" });
        },
      },
      duration: 6000,
    });
  };

  app.saveIndicator = function saveIndicator(status) {
    const indicator = document.getElementById("save-indicator");
    const label = document.getElementById("save-label");
    if (!indicator || !label) return;
    const folderOn = app.storage.folderReady && app.store.settings().autoSaveFolder;
    if (status === "saving") {
      indicator.dataset.state = "saving";
      label.textContent = "保存中";
    } else if (status === "error") {
      indicator.dataset.state = "error";
      label.textContent = "未保存";
    } else {
      indicator.dataset.state = folderOn ? "folder" : "saved";
      label.textContent = folderOn ? "目录" : "本地";
    }
    indicator.title =
      (folderOn && app.storage.folderName ? "数据文件夹：" + app.storage.folderName + "\n" : "") +
      (app.storage.lastSavedAt
        ? "上次保存 " + util.formatClock(app.storage.lastSavedAt)
        : "数据保存在这台电脑上");
  };

  function wireShell() {
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const next =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(next);
        app.store.setSettings({ theme: next });
      });
    }

    const saveBtn = document.getElementById("save-indicator");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => app.navigate("settings"));
    }

    util.qsa(".rail-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        const route = link.dataset.route;
        if (route === "tags") app.tagSelection = "";
        if (location.hash === link.getAttribute("href")) {
          event.preventDefault();
          app.navigate(route);
        }
      });
    });

    window.addEventListener("hashchange", renderRoute);

    document.addEventListener("keydown", (event) => {
      const mod = util.isMac ? event.metaKey : event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        if (SZL.ui.hasActive()) return;
        if (document.querySelector(".focus-overlay, .cmd-overlay")) return;
        event.preventDefault();
        if (SZL.views.openCommand) {
          SZL.views.openCommand({ store: app.store, app });
        }
      }
      if (event.key === "Escape" && !SZL.ui.hasActive && SZL.ui.closeDrawer) {
        SZL.ui.closeDrawer();
      }
    });

    window.addEventListener("pagehide", () => {
      if (app.store && app.storage) app.storage.saveNow(app.store.state);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && app.store && app.storage) {
        app.storage.saveNow(app.store.state);
      }
    });
  }

  async function boot() {
    app.storage = new SZL.Storage();
    await app.storage.init();

    let initial = await app.storage.loadLocal();
    if (!initial && app.storage.folderReady) {
      try {
        const fromFolder = await app.storage.readFolderState();
        if (fromFolder) {
          initial = fromFolder;
          SZL.toast("已从数据文件夹恢复记录。", { icon: "folder" });
        }
      } catch (err) {
        console.warn("[思之流] 无法从文件夹恢复", err);
      }
    } else if (initial && app.storage.folderReady) {
      // The folder may hold a newer copy (another browser, or a restore).
      try {
        const fromFolder = await app.storage.readFolderState();
        if (
          fromFolder &&
          fromFolder.meta &&
          new Date(fromFolder.meta.updatedAt) > new Date(initial.meta.updatedAt)
        ) {
          initial = fromFolder;
          SZL.toast("数据文件夹里有更新的记录，已为你载入。", { icon: "folder" });
        }
      } catch (err) {
        console.warn("[思之流] 无法比较文件夹数据", err);
      }
    }
    if (!initial) {
      initial = SZL.seed.create();
      app.storage.queueSave(initial);
    }

    app.store = new SZL.Store(app.storage, initial);
    applyTheme(app.store.settings().theme);
    applyMotion(app.store.settings().motion !== false);
    app.saveIndicator("saved");

    app.store.on("change", (payload) => {
      if (payload.reason === "settings") {
        applyTheme(app.store.settings().theme);
        applyMotion(app.store.settings().motion !== false);
        app.saveIndicator("saved");
      }
    });

    app.storage.on("saving", () => app.saveIndicator("saving"));
    app.storage.on("saved", () => app.saveIndicator("saved"));
    app.storage.on("error", () => {
      app.saveIndicator("error");
      SZL.toast("保存失败，请检查浏览器存储权限。", { type: "error", icon: "close" });
    });
    app.storage.on("folder", () => app.saveIndicator("saved"));

    wireShell();
    renderRoute();

    if (app.store.state.meta.demo) {
      setTimeout(() => {
        // A quiet first-run hint; the notice itself is already visible in the feed.
      }, 600);
    }
  }

  SZL.app = app;
  window.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      console.error("[思之流] 启动失败", err);
      const main = document.getElementById("view");
      if (main) {
        util.clear(main);
        main.appendChild(errorView(err).el);
      }
    });
  });
})();
