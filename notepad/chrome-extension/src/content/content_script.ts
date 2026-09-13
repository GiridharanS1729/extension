// Content script for AI Prompt Sidebar

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COPY_TO_CLIPBOARD') {
    navigator.clipboard.writeText(message.payload.text)
      .then(() => {
        showToast('Copied to clipboard!');
        sendResponse({ success: true });
      })
      .catch(() => {
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection()?.toString() || '';
    sendResponse({ selection });
    return false;
  }
});

// Toast notification
function showToast(message: string) {
  const existing = document.getElementById('ai-sidebar-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ai-sidebar-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1a1a1a;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.2s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.2s ease-out forwards';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// Inject animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);
