class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'WS-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  createRoom(roomId, hostId, platform) {
    const room = {
      roomId,
      hostId,
      platform,
      createdAt: Date.now(),
      participants: [{ id: hostId, name: 'Host' }]
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  addParticipant(roomId, socketId, name = 'Guest') {
    const room = this.rooms.get(roomId);
    if (room) {
      const exists = room.participants.find(p => p.id === socketId);
      if (!exists) {
        room.participants.push({ id: socketId, name });
      }
    }
  }

  removeParticipant(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== socketId);
      if (room.participants.length === 0) {
        this.rooms.delete(roomId);
        return null;
      }
      return room;
    }
    return null;
  }

  assignNewHost(roomId) {
    const room = this.rooms.get(roomId);
    if (room && room.participants.length > 0) {
      room.hostId = room.participants[0].id;
      return room.hostId;
    }
    return null;
  }

  findRoomBySocketId(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.some(p => p.id === socketId)) {
        return roomId;
      }
    }
    return null;
  }
}

module.exports = new RoomManager();
