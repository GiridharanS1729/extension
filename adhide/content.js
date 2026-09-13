function applyIframeHiding(enabled) {
    let style = document.getElementById("hide-iframes-style");

    if (enabled) {
        if (!style) {
            style = document.createElement("style");
            style.id = "hide-iframes-style";
            style.textContent = `
        iframe {
          display: none !important;
        }
      `;
            document.head.appendChild(style);
        }
    } else {
        if (style) style.remove();
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_IFRAMES") {
        applyIframeHiding(message.enabled);
    }
});
