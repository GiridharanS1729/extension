(() => {
  if (window.__devkitInstalled) return;
  window.__devkitInstalled = true;

  let frame;
  let visible = false;
  let width = Number(localStorage.getItem("devkit-width")) || 420;

  const ensureFrame = () => {
    if (frame) return frame;
    frame = document.createElement("iframe");
    frame.id = "__devkit-sidebar";
    frame.src = chrome.runtime.getURL("sidebar.html");
    frame.title = "DevKit developer sidebar";
    frame.allow = "clipboard-read; clipboard-write";
    Object.assign(frame.style, {
      position: "fixed", top: "10px", right: "10px", bottom: "10px",
      width: `${width}px`, height: "calc(100vh - 20px)", border: "0",
      borderRadius: "16px", zIndex: "2147483647", colorScheme: "light dark",
      boxShadow: "0 24px 80px rgba(0,0,0,.32)", opacity: "0",
      transform: "translateX(calc(100% + 24px)) scale(.985)",
      transition: "transform .28s cubic-bezier(.2,.8,.2,1), opacity .2s ease",
      background: "transparent"
    });
    document.documentElement.appendChild(frame);
    frame.addEventListener("load", () => sendContext());
    return frame;
  };

  const setVisible = next => {
    visible = next;
    const el = ensureFrame();
    requestAnimationFrame(() => {
      el.style.opacity = visible ? "1" : "0";
      el.style.transform = visible ? "translateX(0) scale(1)" : "translateX(calc(100% + 24px)) scale(.985)";
      el.style.pointerEvents = visible ? "auto" : "none";
      if (visible) sendContext();
    });
  };

  const pageContext = () => {
    let local = {}, session = {};
    try { local = { ...localStorage }; } catch {}
    try { session = { ...sessionStorage }; } catch {}
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      url: location.href, domain: location.hostname, protocol: location.protocol.replace(":", ""),
      title: document.title, pageSize: document.documentElement.outerHTML.length,
      local, session, viewport: `${innerWidth} × ${innerHeight}`,
      screen: `${screen.width} × ${screen.height}`, language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser: navigator.userAgent,
      timing: nav ? Math.round(nav.loadEventEnd || performance.now()) : Math.round(performance.now())
    };
  };

  const sendContext = () => frame?.contentWindow?.postMessage({ type: "DEVKIT_CONTEXT", payload: pageContext() }, "*");

  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "DEVKIT_TOGGLE") setVisible(!visible);
  });

  window.addEventListener("message", async event => {
    if (event.source !== frame?.contentWindow || !event.data?.type?.startsWith("DEVKIT_")) return;
    const { type, payload, requestId } = event.data;
    if (type === "DEVKIT_CLOSE") setVisible(false);
    if (type === "DEVKIT_RESIZE") {
      width = Math.min(760, Math.max(340, payload.width));
      frame.style.width = `${width}px`;
      localStorage.setItem("devkit-width", width);
    }
    if (type === "DEVKIT_CONTEXT_REQUEST") sendContext();
    if (type === "DEVKIT_STORAGE_SET") {
      try {
        const store = payload.scope === "session" ? sessionStorage : localStorage;
        payload.value === null ? store.removeItem(payload.key) : store.setItem(payload.key, payload.value);
        sendContext();
      } catch {}
    }
    if (["DEVKIT_COOKIES", "DEVKIT_COOKIE_SET", "DEVKIT_COOKIE_DELETE", "DEVKIT_FETCH"].includes(type)) {
      const response = await chrome.runtime.sendMessage({ type, ...payload });
      frame.contentWindow.postMessage({ type: "DEVKIT_RESPONSE", requestId, payload: response }, "*");
    }
  });

  window.addEventListener("devkit:network", event => {
    frame?.contentWindow?.postMessage({ type: "DEVKIT_NETWORK", payload: event.detail }, "*");
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setVisible(!visible);
    }
  }, true);
})();
