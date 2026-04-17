const DEFAULTS = {
  enabled: true,
  lastConversationId: ''
};

function ensureDefaults() {
  chrome.storage.sync.get(['enabled', 'lastConversationId'], (result) => {
    const updates = {};

    if (typeof result.enabled === 'undefined') {
      updates.enabled = DEFAULTS.enabled;
    }

    if (typeof result.lastConversationId === 'undefined') {
      updates.lastConversationId = DEFAULTS.lastConversationId;
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'lastConversationId'], (result) => {
      sendResponse({
        success: true,
        enabled: result.enabled !== false,
        lastConversationId: result.lastConversationId || ''
      });
    });
    return true;
  }

  if (request.action === 'saveConversationId') {
    const conversationId = String(request.conversationid || '').trim();

    chrome.storage.sync.set({ lastConversationId: conversationId }, () => {
      sendResponse({ success: true, conversationid: conversationId });
    });
    return true;
  }

  if (request.action === 'clearConversationId') {
    chrome.storage.sync.set({ lastConversationId: '' }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
