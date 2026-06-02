document.addEventListener('DOMContentLoaded', () => {
  const initialView = document.getElementById('initial-view');
  const roomView = document.getElementById('room-view');
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const btnLeave = document.getElementById('btn-leave');
  const btnCopy = document.getElementById('btn-copy');
  const inputJoin = document.getElementById('input-join');
  const roomIdDisplay = document.getElementById('room-id-display');
  const participantCount = document.getElementById('participant-count');
  const statusBadge = document.getElementById('status-badge');
  const errorMsg = document.getElementById('error-msg');

  // Check current room state on open
  chrome.runtime.sendMessage({ type: 'GET_ROOM_STATE' }, (state) => {
    if (state && state.connected && state.roomId) {
      showRoomView(state);
    }
  });

  // Listen for background updates
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'room_status_changed') {
      showRoomView(request.data);
    }
  });

  btnCreate.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CREATE_ROOM' });
    btnCreate.textContent = 'Creating...';
    btnCreate.disabled = true;
  });

  btnJoin.addEventListener('click', () => {
    let roomId = inputJoin.value.trim();
    if (!roomId) {
      showError('Please enter a Room ID');
      return;
    }
    
    // Parse if it's a full link (e.g. https://watchsync.app/join/WS-XXXX)
    if (roomId.includes('watchsync.app/join/')) {
      const parts = roomId.split('/');
      roomId = parts[parts.length - 1];
    }
    
    // Basic validation
    if (!roomId.startsWith('WS-')) {
      showError('Invalid Room ID format');
      return;
    }

    chrome.runtime.sendMessage({ 
      type: 'JOIN_ROOM', 
      roomId,
      name: 'User ' + Math.floor(Math.random() * 1000)
    });
    
    btnJoin.textContent = 'Joining...';
    btnJoin.disabled = true;
  });

  btnLeave.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LEAVE_ROOM' }, () => {
      initialView.classList.add('active');
      initialView.classList.remove('hidden');
      roomView.classList.add('hidden');
      roomView.classList.remove('active');
      btnCreate.textContent = 'Create Room';
      btnCreate.disabled = false;
      btnJoin.textContent = 'Join Room';
      btnJoin.disabled = false;
      inputJoin.value = '';
    });
  });

  btnCopy.addEventListener('click', () => {
    const link = `https://watchsync.app/join/${roomIdDisplay.textContent}`;
    navigator.clipboard.writeText(link).then(() => {
      const originalText = btnCopy.textContent;
      btnCopy.textContent = 'Copied!';
      setTimeout(() => {
        btnCopy.textContent = originalText;
      }, 2000);
    });
  });

  function showRoomView(state) {
    initialView.classList.remove('active');
    initialView.classList.add('hidden');
    roomView.classList.remove('hidden');
    roomView.classList.add('active');
    
    roomIdDisplay.textContent = state.roomId;
    participantCount.textContent = state.participants ? state.participants.length : 1;
    
    if (state.isHost) {
      statusBadge.textContent = 'Host';
      statusBadge.className = 'status-badge host';
    } else {
      statusBadge.textContent = 'Guest';
      statusBadge.className = 'status-badge guest';
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => {
      errorMsg.classList.add('hidden');
    }, 3000);
  }
});
