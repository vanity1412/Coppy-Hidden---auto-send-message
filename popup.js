const toggle = document.getElementById('mainToggle');
const statusBadge = document.getElementById('statusBadge');
const statusLabel = document.getElementById('statusLabel');
const statusText = document.getElementById('statusText');
const demoText = document.getElementById('demoText');
const conversationIdInput = document.getElementById('conversationIdInput');
const saveConvIdBtn = document.getElementById('saveConvIdBtn');
const clearConvIdBtn = document.getElementById('clearConvIdBtn');
const convIdStatus = document.getElementById('convIdStatus');
const quickIdBtns = document.querySelectorAll('.quick-id-btn');

function updateUI(enabled) {
  toggle.checked = enabled;

  if (enabled) {
    statusBadge.className = 'status-badge on';
    statusLabel.textContent = 'Đang hoạt động';
    statusText.textContent = 'Extension đang bật trên trang hiện tại.';
    demoText.classList.add('hide-selection');
  } else {
    statusBadge.className = 'status-badge off';
    statusLabel.textContent = 'Đã tắt';
    statusText.textContent = 'Highlight hiển thị bình thường.';
    demoText.classList.remove('hide-selection');
  }
}

function setStatus(message, type = 'info') {
  convIdStatus.textContent = message;
  convIdStatus.className = `conv-status ${type}`;
}

function isValidConversationId(value) {
  return /^\d+$/.test(String(value || '').trim()) && parseInt(value, 10) > 0;
}

chrome.storage.sync.get(['enabled', 'lastConversationId'], (result) => {
  const enabled = result.enabled !== false;
  updateUI(enabled);

  if (result.lastConversationId) {
    conversationIdInput.value = result.lastConversationId;
    setStatus(`Đang dùng Conversation ID: ${result.lastConversationId}`, 'success');
  } else {
    setStatus('Chưa lưu Conversation ID. Bạn có thể nhập ở đây hoặc để content script hỏi khi gửi.', 'info');
  }
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  updateUI(enabled);
});

saveConvIdBtn.addEventListener('click', () => {
  const value = conversationIdInput.value.trim();

  if (!isValidConversationId(value)) {
    setStatus('Conversation ID phải là số dương hợp lệ.', 'error');
    return;
  }

  chrome.storage.sync.set({ lastConversationId: value }, () => {
    setStatus(`Đã lưu Conversation ID: ${value}`, 'success');
  });
});

clearConvIdBtn.addEventListener('click', () => {
  conversationIdInput.value = '';
  chrome.storage.sync.set({ lastConversationId: '' }, () => {
    setStatus('Đã xóa Conversation ID đã lưu.', 'info');
  });
});

quickIdBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id');
    conversationIdInput.value = id;
    chrome.storage.sync.set({ lastConversationId: id }, () => {
      setStatus(`Đã lưu Conversation ID: ${id}`, 'success');
    });
  });
});
