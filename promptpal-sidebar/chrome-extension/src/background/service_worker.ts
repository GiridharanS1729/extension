import { storage, defaultPromptCards } from './lib/storage';
import type { PageContext, PromptCard } from './types';

async function openPanelForWindowTab(tabId: number) {
  try {
    await chrome.sidePanel.open({ tabId });
  } catch {}
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Initialize default settings and cards
  const cards = await storage.getPromptCards();
  if (cards.length === 0) {
    await storage.savePromptCards(defaultPromptCards);
  }

  // Create context menu items
  await createContextMenus();
});

// Create context menus for prompt cards
async function createContextMenus() {
  // Remove existing menus
  await chrome.contextMenus.removeAll();

  // Create parent menu
  chrome.contextMenus.create({
    id: 'ai-prompt-sidebar',
    title: 'AI Prompt Sidebar',
    contexts: ['selection'],
  });

  // Add prompt cards as sub-items
  const cards = await storage.getPromptCards();
  cards.sort((a, b) => a.order - b.order).forEach(card => {
    chrome.contextMenus.create({
      id: `card-${card.id}`,
      parentId: 'ai-prompt-sidebar',
      title: card.title,
      contexts: ['selection'],
    });
  });

  // Add separator and rephrase option
  chrome.contextMenus.create({
    id: 'separator',
    parentId: 'ai-prompt-sidebar',
    type: 'separator',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'rephrase-selection',
    parentId: 'ai-prompt-sidebar',
    title: 'Quick Rephrase',
    contexts: ['selection'],
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  const selection = info.selectionText;

  if (info.menuItemId === 'rephrase-selection') {
    // Open side panel with rephrase mode
    await chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'REPHRASE_SELECTION',
        payload: { selection },
      });
    }, 500);
  } else if (info.menuItemId.toString().startsWith('card-')) {
    const cardId = info.menuItemId.toString().replace('card-', '');
    await chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'RUN_CARD',
        payload: { cardId, selection },
      });
    }, 500);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-sidebar') {
    await chrome.sidePanel.open({ tabId: tab.id });
  } else if (command === 'copy-output') {
    const lastOutput = await storage.getLastOutput();
    if (lastOutput) {
      // Send message to content script to copy
      chrome.tabs.sendMessage(tab.id, {
        type: 'COPY_TO_CLIPBOARD',
        payload: { text: lastOutput },
      });
    }
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const state = await storage.getWindowState(windowId, { panelOpen: false });
  if ((state as any)?.panelOpen) {
    await openPanelForWindowTab(tabId);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.windowId === chrome.windows.WINDOW_ID_NONE || !tab.active || tab.id === undefined) return;
  const state = await storage.getWindowState(tab.windowId, { panelOpen: false });
  if (state.panelOpen) {
    await openPanelForWindowTab(tab.id);
  }
});

// Handle messages from popup/sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTEXT') {
    // Get context from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ selection: '', pageTitle: '', pageUrl: '', pageContent: '' });
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const selection = window.getSelection()?.toString() || '';
            const pageTitle = document.title;
            const pageUrl = window.location.href;
            const pageContent = document.body.innerText.slice(0, 5000); // Limit content
            return { selection, pageTitle, pageUrl, pageContent };
          },
        });

        sendResponse(results[0]?.result || { selection: '', pageTitle: '', pageUrl: '', pageContent: '' });
      } catch {
        sendResponse({ selection: '', pageTitle: tab.title || '', pageUrl: tab.url || '', pageContent: '' });
      }
    });

    return true; // Keep channel open for async response
  }

  if (message.type === 'REFRESH_CONTEXT_MENUS') {
    createContextMenus();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'SAVE_LAST_OUTPUT') {
    storage.setLastOutput(message.payload.output);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'SYNC_WINDOW_STATE') {
    storage.setWindowState(message.payload.windowId, message.payload.state);
    sendResponse({ success: true });
    return false;
  }
});

// Set up side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {});
