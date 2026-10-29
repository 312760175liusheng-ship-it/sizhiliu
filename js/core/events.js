/* ==========================================================================
   Tiny event emitter
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});

  function Events() {
    this._map = new Map();
  }

  Events.prototype.on = function on(name, handler) {
    if (!this._map.has(name)) this._map.set(name, new Set());
    this._map.get(name).add(handler);
    return () => this.off(name, handler);
  };

  Events.prototype.once = function once(name, handler) {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  };

  Events.prototype.off = function off(name, handler) {
    const set = this._map.get(name);
    if (!set) return;
    set.delete(handler);
    if (!set.size) this._map.delete(name);
  };

  Events.prototype.emit = function emit(name, payload) {
    const set = this._map.get(name);
    if (!set) return;
    Array.from(set).forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error("[思之流] listener error:", name, err);
      }
    });
  };

  Events.prototype.clear = function clear() {
    this._map.clear();
  };

  SZL.Events = Events;
})();
