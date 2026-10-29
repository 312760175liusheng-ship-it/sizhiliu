/* ==========================================================================
   FLIP transitions for grid reflow
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const flip = (SZL.flip = {});

  flip.capture = function capture(root, selector) {
    const map = new Map();
    if (!root) return map;
    root.querySelectorAll(selector).forEach((node) => {
      map.set(node, node.getBoundingClientRect());
    });
    return map;
  };

  flip.play = function play(before, options) {
    if (!before || util.prefersReducedMotion()) return;
    const opts = options || {};
    const duration = opts.duration || 480;
    const easing = opts.easing || "cubic-bezier(0.22, 0.61, 0.36, 1)";
    before.forEach((rect, node) => {
      if (!node.isConnected) return;
      const now = node.getBoundingClientRect();
      const dx = rect.left - now.left;
      const dy = rect.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      try {
        node.animate(
          [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "none" }],
          { duration: duration, easing: easing }
        );
      } catch (err) {
        /* older browsers: just skip */
      }
    });
  };

  /**
   * Capture, run a DOM mutation, then animate everything back into place.
   */
  flip.mutate = function mutate(root, selector, mutateFn, options) {
    const before = flip.capture(root, selector);
    const result = mutateFn ? mutateFn() : undefined;
    const wait = (options && options.wait) || 2;
    let frames = 0;
    function tick() {
      frames += 1;
      if (frames >= wait) {
        flip.play(before, options);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return result;
  };
})();
