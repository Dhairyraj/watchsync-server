// shared.js - Shared utilities for content scripts and background service worker

const CONFIG = {
  SERVER_URL: 'https://watchsync-server-n0dv.onrender.com',
  FIREBASE_DB_URL: 'https://watchsync-f84ef-default-rtdb.firebaseio.com',
  FIREBASE_API_KEY: 'AIzaSyBU0l6TsuoqmxFdxKZRxRbDobkdFbd4ybs'
};

// --- Firebase REST API Wrapper ---
class FirebaseAPI {
  static async setRoomData(roomId, data) {
    try {
      const url = `${CONFIG.FIREBASE_DB_URL}/rooms/${roomId}.json${CONFIG.FIREBASE_API_KEY ? '?auth=' + CONFIG.FIREBASE_API_KEY : ''}`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.error('Firebase setRoomData error:', e);
    }
  }

  static async addChatMessage(roomId, messageData) {
    try {
      const url = `${CONFIG.FIREBASE_DB_URL}/rooms/${roomId}/messages.json${CONFIG.FIREBASE_API_KEY ? '?key=' + CONFIG.FIREBASE_API_KEY : ''}`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...messageData, createdAt: { '.sv': 'timestamp' } }) // TTL can be set up in Firebase rules based on createdAt
      });
    } catch (e) {
      console.error('Firebase addChatMessage error:', e);
    }
  }

  static async deleteRoom(roomId) {
    try {
      const url = `${CONFIG.FIREBASE_DB_URL}/rooms/${roomId}.json${CONFIG.FIREBASE_API_KEY ? '?auth=' + CONFIG.FIREBASE_API_KEY : ''}`;
      await fetch(url, { method: 'DELETE' });
    } catch (e) {
      console.error('Firebase deleteRoom error:', e);
    }
  }
}

// --- Room Utilities ---
const RoomUtils = {
  generateRoomId: () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'WS-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
};

// --- Latency Correction ---
class LatencyCorrector {
  constructor(videoElement) {
    this.video = videoElement;
  }

  correct(hostTime) {
    if (!this.video) return;
    const localTime = this.video.currentTime;
    const diff = Math.abs(hostTime - localTime);

    if (diff > 2) {
      // Hard seek if difference is more than 2 seconds
      console.log(`[WatchSync] Hard seek to ${hostTime} (diff: ${diff.toFixed(2)}s)`);
      this.video.currentTime = hostTime;
    } else if (diff > 0.5) {
      // Soft drift correction by adjusting playback rate
      if (hostTime > localTime) {
        this.video.playbackRate = 1.05; // Catch up
      } else {
        this.video.playbackRate = 0.95; // Slow down
      }
      
      // Reset playback rate after 2 seconds
      setTimeout(() => {
        if (this.video) this.video.playbackRate = 1.0;
      }, 2000);
    } else {
      this.video.playbackRate = 1.0;
    }
  }
}

// --- WebSocket Connection Manager (Used by Background Script) ---
class SyncManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxRetries = 5;
    this.messageHandlers = new Map();
    this.isConnecting = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    this.isConnecting = true;
    // Using Engine.IO WebSocket transport directly to communicate with Socket.io server
    const wsUrl = `${CONFIG.SERVER_URL}/socket.io/?EIO=4&transport=websocket`.replace('http://', 'ws://').replace('https://', 'wss://');
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WatchSync] WebSocket connected');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      // Socket.io requires Engine.IO handshake response, we handle it in onmessage
    };

    this.ws.onmessage = (event) => {
      const msg = event.data;
      // Engine.IO protocol
      if (msg.startsWith('0')) {
        // Handshake '0' -> send '40' to connect to default namespace
        this.ws.send('40');
      } else if (msg === '2') {
        // Ping '2' -> send Pong '3'
        this.ws.send('3');
      } else if (msg.startsWith('42')) {
        // Event message '42["event_name", payload]'
        try {
          const payloadString = msg.substring(2);
          const [eventName, data] = JSON.parse(payloadString);
          this._handleEvent(eventName, data);
        } catch (e) {
          console.error('[WatchSync] Failed to parse socket.io message', e);
        }
      }
    };

    this.ws.onclose = () => {
      console.log('[WatchSync] WebSocket disconnected');
      this.isConnecting = false;
      this._handleDisconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WatchSync] WebSocket error:', error);
    };
  }

  _handleDisconnect() {
    if (this.reconnectAttempts < this.maxRetries) {
      this.reconnectAttempts++;
      console.log(`[WatchSync] Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 1000);
    } else {
      console.log('[WatchSync] Max reconnect attempts reached');
      this._handleEvent('connection_lost', {});
    }
  }

  emit(eventName, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify([eventName, data]);
      this.ws.send(`42${payload}`);
    } else {
      console.warn('[WatchSync] WebSocket not open. Cannot emit', eventName);
    }
  }

  on(eventName, callback) {
    if (!this.messageHandlers.has(eventName)) {
      this.messageHandlers.set(eventName, []);
    }
    this.messageHandlers.get(eventName).push(callback);
  }

  _handleEvent(eventName, data) {
    const handlers = this.messageHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(cb => cb(data));
    }
  }
}

// Make globally available for both background script and content script
if (typeof window !== 'undefined') {
  window.FirebaseAPI = FirebaseAPI;
  window.RoomUtils = RoomUtils;
  window.LatencyCorrector = LatencyCorrector;

  // Sidebar Injection Logic (only runs in content script)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    function injectSidebar() {
      if (document.getElementById('watchsync-sidebar-iframe')) return;
      
      const iframe = document.createElement('iframe');
      iframe.id = 'watchsync-sidebar-iframe';
      iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
      iframe.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 300px;
        height: 100vh;
        border: none;
        z-index: 2147483647;
        pointer-events: auto;
      `;
      document.body.appendChild(iframe);
      
      // Make room for sidebar by padding body
      document.body.style.paddingRight = '300px';

      // Hide toggle button if it exists
      const btn = document.getElementById('watchsync-toggle-btn');
      if (btn) btn.style.display = 'none';
    }
    
    // Inject automatically if we are in the main page (not inside another iframe)
    if (window === window.top) {
      function createToggleButton() {
        if (document.getElementById('watchsync-toggle-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'watchsync-toggle-btn';
        btn.innerHTML = '🎬';
        btn.style.cssText = `
          position: fixed;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          z-index: 2147483646;
          background-color: #141414;
          color: #E50914;
          padding: 10px 12px;
          border-radius: 8px 0 0 8px;
          cursor: pointer;
          box-shadow: -2px 0 5px rgba(0,0,0,0.5);
          display: none;
          font-size: 18px;
        `;
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
          injectSidebar();
        });
      }

      if (document.readyState === 'complete') {
        injectSidebar();
        createToggleButton();
      } else {
        window.addEventListener('load', () => {
          injectSidebar();
          createToggleButton();
        });
      }
      
      // Listen for close sidebar message from the iframe
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'WATCHSYNC_CLOSE_SIDEBAR') {
          const iframe = document.getElementById('watchsync-sidebar-iframe');
          if (iframe) {
            iframe.remove();
            document.body.style.paddingRight = '0px';
          }
          const btn = document.getElementById('watchsync-toggle-btn');
          if (btn) btn.style.display = 'block';
        }
      });
    }
  }
}

