# WatchSync

Watch Netflix and JioHotstar together in real-time sync with chat and video call. A production-ready Chrome Extension.

## 📁 Project Structure
```
watchsync/
├── extension/          # The Manifest V3 Chrome Extension
└── server/             # The Node.js + Socket.io Sync Server
```

## 🚀 Setup Instructions

### 1. Sync Server (Backend)
The sync server coordinates WebSocket connections, WebRTC signaling, and room state.

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in your Firebase Database details.
   ```bash
   cp .env.example .env
   ```
4. Start the server:
   ```bash
   npm start
   ```
   *(Server runs on port 3000 by default)*

#### Deployment (Railway/Render)
- Simply link your GitHub repo to Railway or Render.
- Set the Root Directory to `server/`.
- Add the Environment Variables (PORT, FIREBASE_DATABASE_URL).
- Once deployed, update the `SERVER_URL` constant in `extension/content/shared.js` with your deployed URL.

### 2. Firebase Setup
WatchSync uses Firebase Realtime Database to persist room state and chat history.

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Go to **Build > Realtime Database** and create a database.
4. Set the Security Rules to allow read/write or implement custom auth rules.
5. In your `extension/content/shared.js`, update `CONFIG.FIREBASE_DB_URL` with your database URL.

### 3. Chrome Extension (Frontend)
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the `watchsync/extension` folder.
5. Pin the WatchSync extension to your browser toolbar.

## ✨ Features
- **Real-time Sync**: Play, pause, and seek video perfectly synchronized across all participants with automatic latency correction.
- **Multi-Platform**: Supports Netflix, Hotstar, and JioHotstar.
- **Live Chat & Reactions**: Send messages and float emoji reactions instantly.
- **WebRTC Video Call**: Built-in Picture-in-Picture video calling (mesh topology, up to 6 users).
- **Smart Mic**: Automatically mutes you when the movie plays, and unmutes when paused.

## 🛡 Security & Privacy
- No video streams or auth tokens are ever sent to our servers.
- Only play/pause timestamp data and text chats are broadcasted.
- Rooms auto-delete when empty.
- Chat messages expire after 24 hours.

---

### Chrome Web Store Listing Description
**WatchSync: Watch Netflix & Hotstar Together!**

Host virtual movie nights with your friends using WatchSync. This lightweight, fast, and secure extension allows you to sync Netflix and JioHotstar playback in real-time, complete with a built-in sidebar for chat, emoji reactions, and video calling!

**Features:**
- 🎬 **Perfect Sync:** Automatic latency correction keeps your video exactly in sync with the host.
- 💬 **Live Chat & Reactions:** Chat with your friends and send floating emoji reactions right next to the video.
- 📹 **Video Calling (PiP):** Hop on a video call without leaving the movie. Up to 6 friends supported!
- 🎙 **Smart Mic:** Your microphone intelligently mutes when the video plays and unmutes when paused.
- 🔒 **Privacy First:** No account required. No video data or personal information is ever collected.

**How to use:**
1. Open a movie or show on Netflix or Hotstar.
2. Click the WatchSync icon in your browser toolbar.
3. Click "Create Room" to generate a unique invite link.
4. Share the link with your friends.
5. Enjoy watching together!
