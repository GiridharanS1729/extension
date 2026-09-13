const toggleBtn = document.getElementById("toggleBtn");

chrome.storage.local.get("hideEnabled", ({ hideEnabled }) => {
    updateButton(hideEnabled);
});

toggleBtn.addEventListener("click", async () => {
    const { hideEnabled } = await chrome.storage.local.get("hideEnabled");
    const newState = !hideEnabled;

    await chrome.storage.local.set({ hideEnabled: newState });
    updateButton(newState);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    }, () => {
        chrome.tabs.sendMessage(tab.id, {
            type: "TOGGLE_IFRAMES",
            enabled: newState
        });
    });
});

function updateButton(enabled) {
    toggleBtn.textContent = enabled ? "Disable (Show Iframes)" : "Enable (Hide Iframes)";
}
