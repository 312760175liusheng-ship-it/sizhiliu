/* ==========================================================================
   Dialog + confirm
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const ui = (SZL.ui = SZL.ui || {});

  let activeDialog = null;

  function focusable(panel) {
    return Array.from(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? "hidden" : "";
  }

  ui.dialog = function dialog(options) {
    const opts = options || {};
    if (activeDialog) activeDialog.close(true);

    const root = document.getElementById("overlay-root");
    const lastFocus = document.activeElement;

    const overlay = util.el("div", {
      class: "overlay dialog-overlay" + (opts.className ? " " + opts.className : ""),
      attrs: { role: "presentation" },
    });

    const backdrop = util.el("div", { class: "overlay-backdrop" });

    const panel = util.el("div", {
      class: "dialog",
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": opts.title || "对话框",
        tabindex: "-1",
      },
      style: opts.width ? { "--dialog-w": opts.width } : null,
    });

    const header = util.el("header", { class: "dialog-head" }, [
      util.el("div", { class: "dialog-heading" }, [
        opts.eyebrow
          ? util.el("div", { class: "eyebrow no-rule dialog-eyebrow", text: opts.eyebrow })
          : null,
        util.el("h2", { class: "dialog-title", text: opts.title || "" }),
        opts.subtitle
          ? util.el("p", { class: "dialog-subtitle", text: opts.subtitle })
          : null,
      ]),
      util.el("button", {
        class: "dialog-close",
        type: "button",
        attrs: { "aria-label": "关闭" },
        html: util.icon("close", 12),
        on: { click: () => close() },
      }),
    ]);

    const body = util.el("div", { class: "dialog-body" }, opts.content || null);
    const footer = opts.footer ? util.el("footer", { class: "dialog-foot" }, opts.footer) : null;

    panel.appendChild(header);
    panel.appendChild(body);
    if (footer) panel.appendChild(footer);
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    root.appendChild(overlay);
    lockScroll(true);

    let closed = false;
    let onKeyDown = null;

    function close(immediate) {
      if (closed) return;
      closed = true;
      if (activeDialog === controller) activeDialog = null;
      if (onKeyDown) document.removeEventListener("keydown", onKeyDown, true);
      overlay.classList.add("is-closing");
      lockScroll(false);
      const finish = () => {
        overlay.remove();
        if (lastFocus && typeof lastFocus.focus === "function") {
          try {
            lastFocus.focus({ preventScroll: true });
          } catch (err) {
            /* ignore */
          }
        }
        if (typeof opts.onClose === "function") opts.onClose();
      };
      if (immediate || util.prefersReducedMotion()) finish();
      else setTimeout(finish, 200);
    }

    onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusable(panel);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    if (opts.closeOnBackdrop !== false) {
      backdrop.addEventListener("click", () => close());
    }

    overlay.addEventListener("transitionend", (event) => {
      if (event.target === panel && panel.classList.contains("is-open")) {
        /* noop */
      }
    });

    const controller = {
      overlay,
      panel,
      body,
      footer,
      close,
      isOpen: () => !closed,
    };
    activeDialog = controller;

    util.nextFrame(() => {
      overlay.classList.add("is-open");
      const target =
        panel.querySelector("[autofocus]") ||
        panel.querySelector(".dialog-body input, .dialog-body textarea") ||
        focusable(panel)[0] ||
        panel;
      if (target && target.focus) target.focus({ preventScroll: true });
    });

    return controller;
  };

  ui.confirm = function confirm(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const cancelBtn = util.el("button", {
        class: "btn btn-ghost",
        type: "button",
        text: opts.cancelText || "取消",
        on: { click: () => { finish(false); dlg.close(); } },
      });
      const okBtn = util.el("button", {
        class: "btn " + (opts.danger ? "btn-danger" : "btn-primary"),
        type: "button",
        text: opts.confirmText || "确定",
        on: { click: () => { finish(true); dlg.close(); } },
      });

      const dlg = ui.dialog({
        eyebrow: opts.eyebrow || "请确认",
        title: opts.title || "确定吗？",
        subtitle: opts.message || "",
        className: "dialog-confirm",
        width: "440px",
        closeOnBackdrop: opts.closeOnBackdrop !== false,
        content: opts.content || null,
        footer: [cancelBtn, okBtn],
        onClose: () => finish(false),
      });
      setTimeout(() => okBtn.focus({ preventScroll: true }), 60);
    });
  };

  ui.closeActive = function closeActive() {
    if (activeDialog) activeDialog.close();
  };

  ui.hasActive = () => !!activeDialog;
})();
