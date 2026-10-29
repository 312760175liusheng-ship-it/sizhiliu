/* ==========================================================================
   Toasts
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;

  function root() {
    return document.getElementById("toast-root");
  }

  function dismiss(node) {
    if (!node || node.dataset.leaving === "1") return;
    node.dataset.leaving = "1";
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 260);
  }

  function toast(message, options) {
    const opts = options || {};
    const container = root();
    if (!container) return null;

    while (container.children.length >= 3) {
      container.firstElementChild.remove();
    }

    const node = util.el("div", {
      class: "toast" + (opts.type ? " toast-" + opts.type : ""),
      attrs: { role: "status" },
    });

    if (opts.icon) {
      const icon = util.el("span", { class: "toast-icon", html: util.icon(opts.icon, 14) });
      node.appendChild(icon);
    }

    node.appendChild(util.el("span", { class: "toast-text", text: message }));

    if (opts.action && typeof opts.action.onClick === "function") {
      const action = util.el(
        "button",
        {
          class: "toast-action",
          attrs: { type: "button" },
          on: {
            click: () => {
              dismiss(node);
              opts.action.onClick();
            },
          },
        },
        opts.action.label || "撤销"
      );
      node.appendChild(action);
    }

    const close = util.el("button", {
      class: "toast-close",
      html: util.icon("close", 9),
      attrs: { type: "button", "aria-label": "关闭提示" },
      on: { click: () => dismiss(node) },
    });
    node.appendChild(close);

    container.appendChild(node);
    let remaining = opts.duration || 3600;
    let timer = null;
    let startedAt = 0;
    function schedule() {
      startedAt = Date.now();
      timer = setTimeout(() => dismiss(node), remaining);
    }
    schedule();
    node.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      remaining = Math.max(600, remaining - (Date.now() - startedAt));
    });
    node.addEventListener("mouseleave", () => {
      if (remaining > 0) schedule();
    });

    return () => {
      clearTimeout(timer);
      dismiss(node);
    };
  }

  toast.dismissAll = function dismissAll() {
    const container = root();
    if (!container) return;
    Array.from(container.children).forEach((child) => dismiss(child));
  };

  SZL.toast = toast;
})();
