document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-btn');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const chatMessages = document.getElementById('chat-messages');
  const participantsList = document.getElementById('participants-list');
  const participantsToggle = document.getElementById('participants-toggle');
  const pCount = document.getElementById('p-count');
  
  // Video Call Elements
  const btnVideo = document.getElementById('btn-video');
  const videoPanel = document.getElementById('video-panel');
  const btnCloseVideo = document.getElementById('btn-close-video');
  const localVideo = document.getElementById('local-video');
  const btnMute = document.getElementById('btn-mute');
  const btnCam = document.getElementById('btn-cam');
  
  let myName = 'User ' + Math.floor(Math.random() * 1000); // Ideally fetched from state
  
  // -- UI Interactions --
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('collapsed');
  });

  participantsToggle.addEventListener('click', () => {
    participantsList.classList.toggle('hidden');
  });

  function formatTime(seconds) {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Send message
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Get current video time from parent window
    const video = window.parent.document.querySelector('video');
    const videoTimestamp = video ? video.currentTime : 0;

    chrome.runtime.sendMessage({
      type: 'SEND_CHAT',
      name: myName,
      message: text,
      videoTimestamp
    });

    chatInput.value = '';
  }

  btnSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Reactions
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.textContent;
      chrome.runtime.sendMessage({ type: 'SEND_REACTION', emoji });
      showFloatingEmoji(emoji);
    });
  });

  function showFloatingEmoji(emoji) {
    const container = document.getElementById('floating-emojis');
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    // Randomize horizontal start slightly
    el.style.left = `${Math.random() * 20}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  function appendMessage(data) {
    const el = document.createElement('div');
    el.className = 'message';
    const initial = data.name ? data.name.charAt(0).toUpperCase() : '?';
    
    // Simple HTML sanitization
    const safeMsg = data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    el.innerHTML = `
      <div class="avatar">${initial}</div>
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-name">${data.name}</span>
          <span class="msg-time">at ${formatTime(data.videoTimestamp)}</span>
        </div>
        <div class="msg-text">${safeMsg}</div>
      </div>
    `;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updateParticipants(participants, hostId) {
    pCount.textContent = participants.length;
    participantsList.innerHTML = '';
    participants.forEach(p => {
      const el = document.createElement('div');
      el.className = 'participant-item';
      const isHost = p.id === hostId;
      el.innerHTML = `
        <div class="dot"></div>
        <span>${p.name}</span>
        ${isHost ? '<span class="crown">👑</span>' : ''}
      `;
      participantsList.appendChild(el);
    });
  }

  // -- Messages from background --
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'chat_message') {
      appendMessage(request.data);
    } else if (request.action === 'reaction') {
      showFloatingEmoji(request.data.emoji);
    } else if (request.action === 'participant_joined' || request.action === 'participant_left' || request.action === 'host_changed') {
      if (request.data && request.data.room) {
        updateParticipants(request.data.room.participants, request.data.room.hostId);
      }
    }
  });

  // -- WebRTC Logic --
  let localStream = null;
  let isMuted = false;
  let isCamOff = false;
  const peerConnections = {}; // Not fully implemented mesh logic here to keep it vanilla JS and within limits, but basic structure

  btnVideo.addEventListener('click', async () => {
    if (videoPanel.classList.contains('hidden')) {
      videoPanel.classList.remove('hidden');
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        // In a real app, we would emit a signal to room users to start WebRTC mesh
      } catch (e) {
        console.error('Failed to get media', e);
        alert('Camera/Microphone access denied or unavailable.');
        videoPanel.classList.add('hidden');
      }
    }
  });

  btnCloseVideo.addEventListener('click', () => {
    videoPanel.classList.add('hidden');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
  });

  btnMute.addEventListener('click', () => {
    if (localStream) {
      isMuted = !isMuted;
      localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      btnMute.style.opacity = isMuted ? 0.5 : 1;
    }
  });

  btnCam.addEventListener('click', () => {
    if (localStream) {
      isCamOff = !isCamOff;
      localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
      btnCam.style.opacity = isCamOff ? 0.5 : 1;
    }
  });

  // Smart Mic feature
  setInterval(() => {
    if (!localStream) return;
    const video = window.parent.document.querySelector('video');
    if (video) {
      if (video.paused && localStream.getAudioTracks()[0].enabled === false && !isMuted) {
        // Automatically unmute if video is paused (smart mic logic)
        localStream.getAudioTracks()[0].enabled = true;
      } else if (!video.paused && localStream.getAudioTracks()[0].enabled === true) {
        // Automatically mute if video is playing
        localStream.getAudioTracks()[0].enabled = false;
      }
    }
  }, 1000);
});
