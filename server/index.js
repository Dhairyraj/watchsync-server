const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const roomManager = require('./roomManager');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Room Events
  socket.on('create_room', (data) => {
    const roomId = roomManager.generateRoomId();
    const room = roomManager.createRoom(roomId, socket.id, data?.platform || 'unknown');
    
    socket.join(roomId);
    socket.emit('room_created', room);
    console.log(`Room created: ${roomId} by host: ${socket.id}`);
  });

  socket.on('join_room', (data) => {
    const { roomId, name } = data;
    const room = roomManager.getRoom(roomId);
    
    if (room) {
      roomManager.addParticipant(roomId, socket.id, name);
      socket.join(roomId);
      
      const updatedRoom = roomManager.getRoom(roomId);
      socket.emit('room_joined', updatedRoom);
      socket.to(roomId).emit('participant_joined', {
        id: socket.id,
        name: name,
        room: updatedRoom
      });
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Playback Sync Events
  socket.on('player_event', (data) => {
    const { roomId, type, currentTime } = data;
    const room = roomManager.getRoom(roomId);
    
    if (room && room.hostId === socket.id) {
      // Broadcast to all other sockets in the room
      socket.to(roomId).emit('incoming_sync', {
        type,
        currentTime,
        timestamp: Date.now()
      });
    }
  });

  // Chat & Reactions
  socket.on('chat_message', (data) => {
    const { roomId, name, message, videoTimestamp } = data;
    const room = roomManager.getRoom(roomId);
    
    if (room) {
      io.to(roomId).emit('chat_message', {
        senderId: socket.id,
        name,
        message,
        videoTimestamp,
        timestamp: Date.now()
      });
    }
  });

  socket.on('reaction', (data) => {
    const { roomId, emoji } = data;
    socket.to(roomId).emit('reaction', {
      senderId: socket.id,
      emoji
    });
  });

  // WebRTC Signaling
  socket.on('webrtc_offer', (data) => {
    socket.to(data.targetId).emit('webrtc_offer', {
      senderId: socket.id,
      offer: data.offer
    });
  });

  socket.on('webrtc_answer', (data) => {
    socket.to(data.targetId).emit('webrtc_answer', {
      senderId: socket.id,
      answer: data.answer
    });
  });

  socket.on('webrtc_ice_candidate', (data) => {
    socket.to(data.targetId).emit('webrtc_ice_candidate', {
      senderId: socket.id,
      candidate: data.candidate
    });
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    const roomId = roomManager.findRoomBySocketId(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      roomManager.removeParticipant(roomId, socket.id);
      
      const updatedRoom = roomManager.getRoom(roomId);
      
      if (updatedRoom) {
        socket.to(roomId).emit('participant_left', { id: socket.id, room: updatedRoom });
        
        // If host disconnected, assign new host
        if (room.hostId === socket.id && updatedRoom.participants.length > 0) {
          const newHostId = roomManager.assignNewHost(roomId);
          if (newHostId) {
            io.to(roomId).emit('host_changed', { newHostId });
            console.log(`Host changed for room ${roomId}, new host: ${newHostId}`);
          }
        }
      } else {
        console.log(`Room ${roomId} deleted as all participants left.`);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const https = require('https');
setInterval(() => {
  https.get('https://watchsync-server-1.onrender.com');
}, 10 * 60 * 1000);

app.get('/', (req, res) => {
  res.send('WatchSync server running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sync Server running on port ${PORT}`);
});
