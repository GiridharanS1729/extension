const toggle = async tab => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "DEVKIT_TOGGLE" });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "DEVKIT_TOGGLE" });
    } catch {}
  }
};

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener(async command => {
  if (command !== "toggle-devkit") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggle(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DEVKIT_COOKIES") {
    chrome.cookies.getAll({ url: sender.tab?.url || message.url }).then(sendResponse);
    return true;
  }
  if (message.type === "DEVKIT_COOKIE_SET") {
    chrome.cookies.set(message.cookie).then(sendResponse);
    return true;
  }
  if (message.type === "DEVKIT_COOKIE_DELETE") {
    chrome.cookies.remove({ url: message.url, name: message.name }).then(sendResponse);
    return true;
  }
  if (message.type === "DEVKIT_FETCH") {
    const started = performance.now();
    fetch(message.url, message.options)
      .then(async response => sendResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
        duration: Math.round(performance.now() - started)
      }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});
