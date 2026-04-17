const DEFAULTS = {
  enabled: true,
  lastConversationId: '',
  conversationIds: []
};

function ensureDefaults() {
  chrome.storage.sync.get(['enabled', 'lastConversationId', 'conversationIds'], (result) => {
    const updates = {};

    if (typeof result.enabled === 'undefined') {
      updates.enabled = DEFAULTS.enabled;
    }

    if (typeof result.lastConversationId === 'undefined') {
      updates.lastConversationId = DEFAULTS.lastConversationId;
    }

    if (typeof result.conversationIds === 'undefined') {
      updates.conversationIds = DEFAULTS.conversationIds;
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
    chrome.storage.sync.get(['enabled', 'lastConversationId', 'conversationIds'], (result) => {
      sendResponse({
        success: true,
        enabled: result.enabled !== false,
        lastConversationId: result.lastConversationId || '',
        conversationIds: result.conversationIds || []
      });
    });
    return true;
  }

  if (request.action === 'saveConversationId') {
    const conversationId = String(request.conversationid || '').trim();

    chrome.storage.sync.get(['conversationIds'], (result) => {
      let ids = result.conversationIds || [];
      
      // Thêm ID mới nếu chưa có trong danh sách
      if (!ids.includes(conversationId)) {
        ids.push(conversationId);
      }
      
      chrome.storage.sync.set({ 
        lastConversationId: conversationId,
        conversationIds: ids
      }, () => {
        sendResponse({ success: true, conversationid: conversationId });
      });
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
