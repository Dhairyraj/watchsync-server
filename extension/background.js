// background.js - Service worker for background processes

try {
  importScripts('content/shared.js');
} catch (e) {
  console.error('[WatchSync] Failed to load shared.js', e);
}

const syncManager = new SyncManager();
let roomState = {
  roomId: null,
  isHost: false,
  participants: [],
  platform: null,
  connected: false
};

// WebSocket Event Listeners
syncManager.on('room_created', (room) => {
  roomState.roomId = room.roomId;
  roomState.isHost = true;
  roomState.participants = room.participants;
  roomState.platform = room.platform;
  roomState.connected = true;
  updateStorage();
  
  FirebaseAPI.setRoomData(room.roomId, {
    hostId: room.hostId,
    platform: room.platform,
    createdAt: room.createdAt,
    participants: room.participants
  });
  
  notifyPopup('room_status_changed', roomState);
});

syncManager.on('room_joined', (room) => {
  roomState.roomId = room.roomId;
  roomState.isHost = false;
  roomState.participants = room.participants;
  roomState.platform = room.platform;
  roomState.connected = true;
  updateStorage();
  notifyPopup('room_status_changed', roomState);
  notifySidebar('room_joined', room);
});

syncManager.on('participant_joined', (data) => {
  roomState.participants = data.room.participants;
  updateStorage();
  notifySidebar('participant_joined', data);
  notifyPopup('room_status_changed', roomState);
});

syncManager.on('participant_left', (data) => {
  roomState.participants = data.room.participants;
  updateStorage();
  notifySidebar('participant_left', data);
  notifyPopup('room_status_changed', roomState);
});

syncManager.on('host_changed', (data) => {
  notifySidebar('host_changed', data);
  notifyPopup('room_status_changed', roomState);
});

syncManager.on('incoming_sync', (data) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'INCOMING_SYNC',
        data: data
      }).catch(() => {});
    }
  });
});

syncManager.on('chat_message', (data) => {
  notifySidebar('chat_message', data);
});

syncManager.on('reaction', (data) => {
  notifySidebar('reaction', data);
});

syncManager.on('connection_lost', () => {
  roomState.connected = false;
  updateStorage();
  notifyPopup('room_status_changed', roomState);
});

// Extension Message Listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.type === 'CREATE_ROOM') {
    syncManager.connect();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let platform = 'unknown';
      if (tabs[0] && tabs[0].url) {
        if (tabs[0].url.includes('netflix.com')) platform = 'netflix';
        else if (tabs[0].url.includes('hotstar.com') || tabs[0].url.includes('jiohotstar.com')) platform = 'hotstar';
        else if (tabs[0].url.includes('youtube.com')) platform = 'youtube';
        else if (tabs[0].url.includes('primevideo.com') || tabs[0].url.includes('amazon.com')) platform = 'prime';
        else if (tabs[0].url.includes('drive.google.com')) platform = 'drive';
      }
      setTimeout(() => {
        syncManager.emit('create_room', { platform });
      }, 100);
    });
    sendResponse({ status: 'connecting' });
  }

  else if (request.type === 'JOIN_ROOM') {
    syncManager.connect();
    const name = request.name || 'Guest';
    setTimeout(() => {
      syncManager.emit('join_room', { roomId: request.roomId, name });
    }, 100);
    sendResponse({ status: 'connecting' });
  }

  else if (request.type === 'PLAYER_EVENT') {
    if (roomState.connected) {
      syncManager.emit('player_event', {
        roomId: roomState.roomId,
        type: request.event,
        currentTime: request.currentTime
      });
    }
  }

  else if (request.type === 'GET_ROOM_STATE') {
    sendResponse(roomState);
  }

  else if (request.type === 'SEND_CHAT') {
    syncManager.emit('chat_message', {
      roomId: roomState.roomId,
      name: request.name,
      message: request.message,
      videoTimestamp: request.videoTimestamp
    });
    FirebaseAPI.addChatMessage(roomState.roomId, {
      name: request.name,
      text: request.message,
      videoTimestamp: request.videoTimestamp
    });
  }

  else if (request.type === 'SEND_REACTION') {
    syncManager.emit('reaction', {
      roomId: roomState.roomId,
      emoji: request.emoji
    });
  }

  else if (request.type === 'LEAVE_ROOM') {
    if (syncManager.ws) {
      syncManager.ws.close();
      syncManager.ws = null;
    }
    roomState = {
      roomId: null,
      isHost: false,
      participants: [],
      platform: null,
      connected: false
    };
    updateStorage();
    sendResponse({ status: 'left' });
  }

  return true;
});

function updateStorage() {
  chrome.storage.local.set({ roomState });
}

function notifyPopup(action, data) {
  chrome.runtime.sendMessage({ action, data }).catch(() => {});
}

function notifySidebar(action, data) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action, data }).catch(() => {});
    }
  });
}