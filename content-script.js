let selectionMarker = null;
let sendTimeout = null;
let isSending = false;
let lastSelectionFingerprint = '';

function removeMarkers() {
  if (selectionMarker) {
    selectionMarker.remove();
    selectionMarker = null;
  }
}

function getFingerprint(text) {
  return `${window.location.href}::${text}`;
}

function isValidConversationId(value) {
  return /^\d+$/.test(String(value || '').trim()) && parseInt(value, 10) > 0;
}

function getStorageValue(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
}

function setStorageValue(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, () => resolve());
  });
}

function extractSessionKey() {
  const inputSesskey = document.querySelector('input[name="sesskey"]')?.value;
  if (inputSesskey) return inputSesskey;

  const urlParams = new URLSearchParams(window.location.search);
  const querySesskey = urlParams.get('sesskey');
  if (querySesskey) return querySesskey;

  if (window.M?.cfg?.sesskey) {
    return window.M.cfg.sesskey;
  }

  const metaSesskey = document.querySelector('meta[name="moodle-sesskey"]')?.getAttribute('content');
  if (metaSesskey) return metaSesskey;

  const match1 = document.documentElement.innerHTML.match(/["']sesskey["']\s*[:=]\s*["']([a-zA-Z0-9]+)["']/);
  if (match1) return match1[1];

  const match2 = document.documentElement.innerHTML.match(/sesskey["'\s:=]+([a-zA-Z0-9]{10,})/);
  if (match2) return match2[1];

  return null;
}

function extractConversationIdFromPage() {
  const html = document.documentElement.innerHTML;
  const candidates = [
    /conversationid["'\s:=]+(\d+)/i,
    /"conversationid"\s*:\s*(\d+)/i,
    /conversation\/view\.php\?id=(\d+)/i,
    /\/message\/index\.php\?.*?id=(\d+)/i,
    /data-conversation-id=["'](\d+)["']/i
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match && isValidConversationId(match[1])) {
      return match[1];
    }
  }

  const activeConversation = document.querySelector('[data-conversation-id]');
  if (activeConversation) {
    const value = activeConversation.getAttribute('data-conversation-id');
    if (isValidConversationId(value)) return value;
  }

  return '';
}

async function getConversationId() {
  const pageConversationId = extractConversationIdFromPage();
  if (isValidConversationId(pageConversationId)) {
    await setStorageValue({ lastConversationId: pageConversationId });
    return pageConversationId;
  }

  const result = await getStorageValue(['lastConversationId']);
  if (isValidConversationId(result.lastConversationId)) {
    return String(result.lastConversationId).trim();
  }

  return '';
}

function getApiUrl(sesskey) {
  return `${window.location.origin}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=core_message_send_messages_to_conversation`;
}

function parseServerError(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return 'Phản hồi server không hợp lệ.';
  }

  const item = result[0];

  if (item?.error === true) {
    return item.exception?.message || item.message || 'Lỗi từ server.';
  }

  if (item?.exception) {
    return item.exception?.message || item.message || 'Lỗi từ server.';
  }

  return '';
}

function extractConversationIdFromResponse(result) {
  if (!Array.isArray(result) || result.length === 0) return null;

  const item = result[0];
  
  // Thử lấy từ data.conversationid
  if (item?.data?.conversationid) {
    return String(item.data.conversationid);
  }
  
  // Thử lấy từ data[0].conversationid
  if (Array.isArray(item?.data) && item.data[0]?.conversationid) {
    return String(item.data[0].conversationid);
  }
  
  // Thử lấy từ conversationid trực tiếp
  if (item?.conversationid) {
    return String(item.conversationid);
  }
  
  // Thử tìm trong toàn bộ response object
  const jsonStr = JSON.stringify(item);
  const match = jsonStr.match(/"conversationid"\s*:\s*(\d+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

async function doSendMessage(selectedText, conversationId, sesskey) {
  const apiUrl = getApiUrl(sesskey);

  const payload = [{
    index: 0,
    methodname: 'core_message_send_messages_to_conversation',
    args: {
      conversationid: parseInt(conversationId, 10),
      messages: [{ text: selectedText }]
    }
  }];

  console.log('📤 Sending message', {
    conversationId,
    text: selectedText.slice(0, 80),
    apiUrl
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  console.log('📥 Response status:', response.status);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('📥 Server response:', result);

  const serverError = parseServerError(result);
  if (serverError) {
    throw new Error(serverError);
  }

  // Tự động lấy conversation ID từ response và lưu lại
  const extractedId = extractConversationIdFromResponse(result);
  if (extractedId && isValidConversationId(extractedId)) {
    console.log('✨ Auto-extracted conversation ID from response:', extractedId);
    await setStorageValue({ lastConversationId: extractedId });
  } else {
    // Nếu không extract được, vẫn lưu ID đã dùng
    await setStorageValue({ lastConversationId: String(conversationId) });
  }

  return result;
}

async function sendSelectedTextMessage(selectedText) {
  const normalizedText = (selectedText || '').trim();
  if (!normalizedText || isSending) return;

  const currentFingerprint = getFingerprint(normalizedText);
  if (currentFingerprint === lastSelectionFingerprint) return;

  const settings = await getStorageValue(['enabled']);
  if (settings.enabled === false) return;

  const sesskey = extractSessionKey();
  if (!sesskey) {
    console.error('❌ Không tìm thấy sesskey. Hãy mở đúng trang chat/conversation Moodle rồi thử lại.');
    return;
  }

  let conversationId = await getConversationId();

  if (!conversationId) {
    console.error('❌ Không tìm thấy Conversation ID. Vui lòng lưu ID trong popup extension.');
    return;
  }

  try {
    isSending = true;
    await doSendMessage(normalizedText, conversationId, sesskey);
    lastSelectionFingerprint = currentFingerprint;
    console.log('✅ Tin nhắn đã gửi thành công.');
  } catch (error) {
    console.error('❌ Lỗi gửi tin nhắn:', error.message, error);
  } finally {
    isSending = false;
  }
}

function showQuoteMarks() {
  const selection = window.getSelection();
  const text = selection?.toString()?.trim();

  if (!text || selection.rangeCount === 0) {
    removeMarkers();
    return;
  }

  removeMarkers();

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  if (!rects.length) return;

  const startRect = rects[0];
  const endRect = rects[rects.length - 1];

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;left:0;top:0;width:100vw;height:100vh;';

  function makeMark(char, left, top) {
    const el = document.createElement('div');
    el.textContent = char;
    el.style.cssText = `position:absolute;left:${left}px;top:${top}px;color:#ff0000;font-size:18px;font-weight:bold;font-family:Georgia,serif;`;
    return el;
  }

  container.appendChild(makeMark('"', startRect.left - 8, startRect.top));
  container.appendChild(makeMark('"', endRect.right + 2, endRect.top));
  document.body.appendChild(container);
  selectionMarker = container;
}

function handleSelectionChange() {
  const selectedText = window.getSelection()?.toString()?.trim() || '';
  showQuoteMarks();

  clearTimeout(sendTimeout);

  if (!selectedText) {
    return;
  }

  sendTimeout = setTimeout(() => {
    sendSelectedTextMessage(selectedText);
  }, 150);
}

document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('mouseup', handleSelectionChange);
document.addEventListener('touchend', handleSelectionChange);

document.addEventListener('click', () => {
  setTimeout(() => {
    if (!window.getSelection()?.toString()) {
      removeMarkers();
    }
  }, 10);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.enabled && changes.enabled.newValue === false) {
    removeMarkers();
  }
});
