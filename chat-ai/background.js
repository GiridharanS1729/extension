chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        uiMode: "popup",
        historyLimit: 5,
        provider: "openai",
        theme: "light",
        keys: { openai: "", gemini: "" }
    });
});

chrome.action.onClicked.addListener(() => {
    chrome.storage.local.get("uiMode", ({ uiMode }) => {
        if (uiMode === "sidepanel") {
            chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
        }
    });
});

chrome.commands.onCommand.addListener(cmd => {
    if (cmd === "copy-output") {
        chrome.runtime.sendMessage({ type: "COPY_OUTPUT" });
    }
});
