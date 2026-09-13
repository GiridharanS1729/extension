document.getElementById("btn").onclick = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document
        .querySelectorAll(".global-loader-wrapper")
        .forEach((el) => el.remove());
    },
  });
};
