/* ==========================================================================
   Side drawer (note detail from tags / tree)
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const ui = (SZL.ui = SZL.ui || {});

  let activeDrawer = null;

  ui.drawer = function drawer(options) {
    const opts = options || {};
    if (activeDrawer) activeDrawer.close(true);
    const root = document.getElementById("overlay-root");
    const lastFocus = document.activeElement;

    const overlay = util.el("div", { class: "overlay drawer-overlay" });
    const backdrop = util.el("div", { class: "overlay-backdrop" });
    const panel = util.el("aside", {
      class: "drawer",
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": opts.title || "详情",
        tabindex: "-1",
      },
    });

    const head = util.el("header", { class: "drawer-head" }, [
      util.el("div", { class: "drawer-heading" }, [
        opts.eyebrow
          ? util.el("div", { class: "eyebrow no-rule drawer-eyebrow", text: opts.eyebrow })
          : null,
        opts.title ? util.el("h2", { class: "drawer-title", text: opts.title }) : null,
        opts.subtitle ? util.el("p", { class: "drawer-subtitle", text: opts.subtitle }) : null,
      ]),
      util.el("button", {
        class: "dialog-close",
        type: "button",
        attrs: { "aria-label": "关闭" },
        html: util.icon("close", 12),
        on: { click: () => close() },
      }),
    ]);

    const body = util.el("div", { class: "drawer-body" }, opts.content || null);

    panel.appendChild(head);
    panel.appendChild(body);
    if (opts.footer) panel.appendChild(util.el("footer", { class: "drawer-foot" }, opts.footer));
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    root.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";

    let closed = false;
    let keyHandler = null;

    function close(immediate) {
      if (closed) return;
      closed = true;
      if (activeDrawer === controller) activeDrawer = null;
      if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
      overlay.classList.add("is-closing");
      document.documentElement.style.overflow = "";
      const finish = () => {
        overlay.remove();
        if (lastFocus && lastFocus.focus) {
          try {
            lastFocus.focus({ preventScroll: true });
          } catch (err) {
            /* ignore */
          }
        }
        if (opts.onClose) opts.onClose();
      };
      if (immediate || util.prefersReducedMotion()) finish();
      else setTimeout(finish, 260);
    }

    keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", keyHandler, true);
    backdrop.addEventListener("click", () => close());

    const controller = { overlay, panel, body, close, isOpen: () => !closed };
    activeDrawer = controller;

    util.nextFrame(() => {
      overlay.classList.add("is-open");
      const first = panel.querySelector("[data-autofocus]") || panel;
      if (first.focus) first.focus({ preventScroll: true });
    });

    return controller;
  };

  ui.closeDrawer = function closeDrawer() {
    if (activeDrawer) activeDrawer.close();
  };
})();
