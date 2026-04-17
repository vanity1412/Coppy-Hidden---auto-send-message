const toggle = document.getElementById('mainToggle');
const statusBadge = document.getElementById('statusBadge');
const statusLabel = document.getElementById('statusLabel');
const statusText = document.getElementById('statusText');
const demoText = document.getElementById('demoText');
const conversationIdSelect = document.getElementById('conversationIdSelect');
const conversationIdInput = document.getElementById('conversationIdInput');
const saveConvIdBtn = document.getElementById('saveConvIdBtn');
const deleteConvIdBtn = document.getElementById('deleteConvIdBtn');
const convIdStatus = document.getElementById('convIdStatus');

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

function loadConversationIds() {
  chrome.storage.sync.get(['conversationIds', 'lastConversationId'], (result) => {
    const ids = result.conversationIds || [];
    const currentId = result.lastConversationId || '';

    // Clear và rebuild select options
    conversationIdSelect.innerHTML = '<option value="">-- Chọn ID đã lưu --</option>';
    
    ids.forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `ID: ${id}`;
      if (id === currentId) {
        option.selected = true;
      }
      conversationIdSelect.appendChild(option);
    });

    if (currentId) {
      conversationIdInput.value = currentId;
      setStatus(`Đang dùng Conversation ID: ${currentId}`, 'success');
    } else if (ids.length > 0) {
      setStatus(`Có ${ids.length} ID đã lưu. Chọn một ID để sử dụng.`, 'info');
    } else {
      setStatus('Chưa có ID nào. Nhập ID mới và bấm "Lưu ID".', 'info');
    }
  });
}

chrome.storage.sync.get(['enabled'], (result) => {
  const enabled = result.enabled !== false;
  updateUI(enabled);
  loadConversationIds();
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  updateUI(enabled);
});

conversationIdSelect.addEventListener('change', () => {
  const selectedId = conversationIdSelect.value;
  
  if (selectedId) {
    conversationIdInput.value = selectedId;
    chrome.storage.sync.set({ lastConversationId: selectedId }, () => {
      setStatus(`Đã chọn Conversation ID: ${selectedId}`, 'success');
    });
  }
});

saveConvIdBtn.addEventListener('click', () => {
  const value = conversationIdInput.value.trim();

  if (!isValidConversationId(value)) {
    setStatus('Conversation ID phải là số dương hợp lệ.', 'error');
    return;
  }

  chrome.storage.sync.get(['conversationIds'], (result) => {
    let ids = result.conversationIds || [];
    
    // Thêm ID mới nếu chưa có
    if (!ids.includes(value)) {
      ids.push(value);
      chrome.storage.sync.set({ conversationIds: ids, lastConversationId: value }, () => {
        setStatus(`Đã lưu ID mới: ${value}`, 'success');
        loadConversationIds();
      });
    } else {
      chrome.storage.sync.set({ lastConversationId: value }, () => {
        setStatus(`Đã chọn ID: ${value}`, 'success');
        loadConversationIds();
      });
    }
  });
});

deleteConvIdBtn.addEventListener('click', () => {
  const selectedId = conversationIdSelect.value;
  
  if (!selectedId) {
    setStatus('Chọn một ID từ danh sách để xóa.', 'error');
    return;
  }

  chrome.storage.sync.get(['conversationIds', 'lastConversationId'], (result) => {
    let ids = result.conversationIds || [];
    ids = ids.filter(id => id !== selectedId);
    
    const updates = { conversationIds: ids };
    
    // Nếu đang dùng ID này thì clear lastConversationId
    if (result.lastConversationId === selectedId) {
      updates.lastConversationId = '';
      conversationIdInput.value = '';
    }
    
    chrome.storage.sync.set(updates, () => {
      setStatus(`Đã xóa ID: ${selectedId}`, 'info');
      loadConversationIds();
    });
  });
});
