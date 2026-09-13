(() => {
  const emit = detail => window.dispatchEvent(new CustomEvent("devkit:network", { detail }));
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const started = performance.now();
    const method = args[1]?.method || "GET";
    const url = String(args[0]?.url || args[0]);
    try {
      const response = await originalFetch(...args);
      emit({ type: "fetch", method, url, status: response.status, duration: Math.round(performance.now() - started), size: Number(response.headers.get("content-length")) || 0, time: Date.now() });
      return response;
    } catch (error) {
      emit({ type: "fetch", method, url, status: 0, duration: Math.round(performance.now() - started), size: 0, error: error.message, time: Date.now() });
      throw error;
    }
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__devkit = { method, url: String(url) };
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const started = performance.now();
    this.addEventListener("loadend", () => emit({ type: "xhr", ...this.__devkit, status: this.status, duration: Math.round(performance.now() - started), size: Number(this.getResponseHeader("content-length")) || 0, time: Date.now() }), { once: true });
    return send.apply(this, args);
  };
})();
