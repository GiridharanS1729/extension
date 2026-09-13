// background.js
//
// The old version of this file kept a long-lived-port relay so every open
// copy of the panel stayed in perfect real-time sync. That behavior has been
// removed on purpose: notes are no longer pushed live between views. Instead
// each panel now saves explicitly (see sidepanel.js), and everything saved
// lives in chrome.storage.local so it survives a browser restart.
//
// All that's left for the background worker to do is open the panel when
// the toolbar icon is clicked.

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-selection-to-notebook",
    title: "Send selection to Notebook",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-selection-to-notebook" || !tab?.windowId) return;

  await chrome.sidePanel.open({ windowId: tab.windowId });
  chrome.runtime.sendMessage({
    type: "selection-text",
    content: info.selectionText || "",
  });
});
