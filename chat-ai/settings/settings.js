(async () => {
    const data = await chrome.storage.local.get([
        "provider",
        "uiMode",
        "historyLimit",
        "keys"
    ]);

    provider.value = data.provider;
    uiMode.value = data.uiMode;
    history.value = data.historyLimit;
    openai.value = data.keys?.openai || "";
    gemini.value = data.keys?.gemini || "";
})();

save.onclick = () => {
    chrome.storage.local.set({
        provider: provider.value,
        uiMode: uiMode.value,
        historyLimit: Number(history.value),
        keys: {
            openai: openai.value,
            gemini: gemini.value
        }
    });
};
