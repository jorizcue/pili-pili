'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Game } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});

// Rooms: Map<roomId, { game: Game, sockets: Map<playerId, socketId> }>
const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let id;
  do {
    id = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(id));
  return id;
}

function broadcastState(room, roomId) {
  const { game, sockets } = room;
  for (const [playerId, socketId] of sockets.entries()) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) {
      sock.emit('gameState', game.getStateForPlayer(playerId));
    }
  }
}

function findRoomBySocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    for (const [playerId, sid] of room.sockets.entries()) {
      if (sid === socketId) return { roomId, room, playerId };
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  socket.on('createRoom', ({ playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      return socket.emit('error', { message: 'Ingresa tu nombre' });
    }
    const name = playerName.trim().substring(0, 20);
    const roomId = generateRoomId();
    const game = new Game(roomId);
    const result = game.addPlayer(socket.id, name);
    if (!result.success) return socket.emit('error', { message: result.error });

    const sockets = new Map();
    sockets.set(socket.id, socket.id);
    rooms.set(roomId, { game, sockets });
    socket.join(roomId);

    socket.emit('roomCreated', { roomId, playerId: socket.id });
    broadcastState(rooms.get(roomId), roomId);
    console.log(`[Room] Created: ${roomId} by ${name}`);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      return socket.emit('error', { message: 'Ingresa tu nombre' });
    }
    const name = playerName.trim().substring(0, 20);
    const room = rooms.get(roomId?.toUpperCase());
    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });

    const result = room.game.addPlayer(socket.id, name);
    if (!result.success) return socket.emit('error', { message: result.error });

    room.sockets.set(socket.id, socket.id);
    socket.join(roomId.toUpperCase());

    socket.emit('roomCreated', { roomId: roomId.toUpperCase(), playerId: socket.id });
    broadcastState(room, roomId.toUpperCase());
    console.log(`[Room] ${name} joined ${roomId.toUpperCase()}`);
  });

  socket.on('reconnect', ({ roomId, playerName }) => {
    const rid = roomId?.toUpperCase();
    const room = rooms.get(rid);
    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });

    const result = room.game.reconnectPlayer(socket.id, playerName);
    if (!result.success) return socket.emit('error', { message: result.error });

    // Update socket mapping
    // Remove old entry for this player name
    for (const [pid, sid] of room.sockets.entries()) {
      const player = room.game.players.find(p => p.id === pid && p.name === playerName);
      if (player) {
        room.sockets.delete(pid);
        break;
      }
    }
    room.sockets.set(socket.id, socket.id);
    socket.join(rid);

    socket.emit('roomCreated', { roomId: rid, playerId: socket.id });
    broadcastState(room, rid);
    console.log(`[Room] ${playerName} reconnected to ${rid}`);
  });

  socket.on('startGame', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return socket.emit('error', { message: 'No estás en una sala' });
    const { room, roomId, playerId } = found;
    if (room.game.hostId !== playerId) return socket.emit('error', { message: 'Solo el anfitrión puede iniciar' });

    const result = room.game.startGame();
    if (!result.success) return socket.emit('error', { message: result.error });

    broadcastState(room, roomId);
    console.log(`[Game] Started in room ${roomId}`);
  });

  socket.on('placeBet', ({ bet }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return socket.emit('error', { message: 'No estás en una sala' });
    const { room, roomId, playerId } = found;

    const result = room.game.placeBet(playerId, bet);
    if (!result.success) return socket.emit('error', { message: result.error });

    broadcastState(room, roomId);
  });

  socket.on('passCard', ({ cardIndex }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return socket.emit('error', { message: 'No estás en una sala' });
    const { room, roomId, playerId } = found;

    const result = room.game.passCard(playerId, cardIndex);
    if (!result.success) return socket.emit('error', { message: result.error });

    if (result.allPassed) {
      console.log(`[Pass] All cards passed in ${roomId}`);
    }
    broadcastState(room, roomId);
  });

  socket.on('playCard', ({ cardIndex }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return socket.emit('error', { message: 'No estás en una sala' });
    const { room, roomId, playerId } = found;

    const result = room.game.playCard(playerId, cardIndex);
    if (!result.success) return socket.emit('error', { message: result.error });

    if (result.trickComplete) {
      // Broadcast immediately so all players see the played card
      broadcastState(room, roomId);

      // Resolve after 1.5 seconds
      setTimeout(() => {
        const trickResult = room.game.resolveTrick();
        console.log(`[Trick] Winner: ${trickResult.winnerName} in ${roomId}`);

        if (room.game.isRoundOver()) {
          const scores = room.game.scoreRound();
          const gameOver = room.game.checkGameEnd();
          console.log(`[Round] Over in ${roomId}. Game over: ${gameOver}`);
        }

        broadcastState(room, roomId);
      }, 1500);
    } else {
      broadcastState(room, roomId);
    }
  });

  socket.on('nextRound', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return socket.emit('error', { message: 'No estás en una sala' });
    const { room, roomId, playerId } = found;
    if (room.game.hostId !== playerId) return socket.emit('error', { message: 'Solo el anfitrión puede avanzar' });

    const result = room.game.nextRound();
    if (!result.success) return socket.emit('error', { message: result.error });

    broadcastState(room, roomId);
    console.log(`[Round] Next round in ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, roomId, playerId } = found;

    room.game.removePlayer(playerId, () => {
      broadcastState(room, roomId);
    });

    // If no players left, clean up room
    if (room.game.players.length === 0) {
      rooms.delete(roomId);
      console.log(`[Room] Deleted empty room ${roomId}`);
    } else {
      broadcastState(room, roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌶️  Pili Pili server running on http://localhost:${PORT}`);
});
