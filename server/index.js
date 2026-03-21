'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Game, MODE_FAMILIES, RULE_FAMILY } = require('./game');
const { mountAuthRoutes, verifyToken } = require('./auth');
const { mountAdminRoutes } = require('./admin');
const { findUserById, getLevel, calcEloChanges, applyEloChanges } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// JSON body parser + auth routes
app.use(express.json());
mountAuthRoutes(app);
mountAdminRoutes(app);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/api/public-rooms', (req, res) => {
  const list = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.isPublic && room.game.state === 'lobby') {
      const ageMs = Date.now() - room.createdAt;
      const ageMins = Math.floor(ageMs / 60000);
      const ageStr = ageMins < 60
        ? `Hace ${ageMins}m`
        : `Hace ${Math.floor(ageMins / 60)}h${ageMins % 60 > 0 ? ' ' + (ageMins % 60) + 'm' : ''}`;
      list.push({
        roomId,
        roomName: room.roomName || roomId,
        hostName: room.game.players[0]?.name || '?',
        playerCount: room.game.players.length,
        createdAt: room.createdAt,
        ageStr,
      });
    }
  }
  // Sort by newest first
  list.sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
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
  const { game, sockets, pendingPlayers, isPublic, roomName, userMap } = room;
  for (const [playerId, socketId] of sockets.entries()) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) {
      const state = game.getStateForPlayer(playerId);
      state.roomName = roomName || '';
      state.isPublic = !!isPublic;
      state.pendingRequests = playerId === game.hostId
        ? [...(pendingPlayers || new Map()).values()].map(p => ({ socketId: p.socketId, name: p.name }))
        : [];
      // Augment players with ELO/level if registered
      if (userMap) {
        state.players = state.players.map(p => {
          const userId = userMap.get(p.id);
          if (userId) {
            const user = findUserById(userId);
            if (user) {
              const level = getLevel(user.elo);
              return { ...p, elo: user.elo, level };
            }
          }
          return p;
        });
      }
      sock.emit('gameState', state);
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

// Cleanup stale lobby rooms older than 3 hours
setInterval(() => {
  const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
  for (const [roomId, room] of rooms.entries()) {
    if (room.game.state === 'lobby' && room.createdAt < threeHoursAgo) {
      rooms.delete(roomId);
      console.log(`[Room] Auto-deleted stale room ${roomId}`);
    }
  }
}, 5 * 60 * 1000);

function handleGameEnd(room) {
  if (!room.userMap || room.userMap.size === 0) return;
  const game = room.game;
  if (game.state !== 'game_end') return;

  // Sort players by pilis ascending (best = fewer pilis)
  const sorted = [...game.players]
    .sort((a, b) => a.pilis - b.pilis)
    .map((p, rank) => {
      const userId = room.userMap.get(p.id);
      if (!userId) return null;
      const user = findUserById(userId);
      if (!user) return null;
      return { userId, elo: user.elo, rank, name: p.name, isWinner: p.name === game.winner };
    })
    .filter(Boolean);

  if (sorted.length < 2) return;

  const changes = calcEloChanges(sorted);
  applyEloChanges(changes);

  // Mark wins
  const winner = sorted.find(p => p.isWinner);
  if (winner) {
    const user = findUserById(winner.userId);
    if (user) {
      const { updateUser } = require('./db');
      updateUser(winner.userId, { wins: (user.wins || 0) + 1 });
    }
  }

  console.log('[ELO] Updated:', changes.map(c => `${c.userId}: ${c.change > 0 ? '+' : ''}${c.change} → ${c.newElo}`).join(', '));
}

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Check if socket has a valid JWT → attach user info
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    const payload = verifyToken(authToken);
    if (payload) {
      const user = findUserById(payload.userId);
      if (user) {
        socket.user = { userId: user.id, nickname: user.nickname, elo: user.elo };
      }
    }
  }

  socket.on('createRoom', ({ playerName, roomName, isPublic }) => {
    if (!playerName || playerName.trim().length === 0) {
      return socket.emit('error', { message: 'Ingresa tu nombre' });
    }
    const name = playerName.trim().substring(0, 20);
    const rName = (roomName || '').trim().substring(0, 30);
    const pub = isPublic !== false; // default public
    const roomId = generateRoomId();
    const game = new Game(roomId);
    const result = game.addPlayer(socket.id, name);
    if (!result.success) return socket.emit('error', { message: result.error });

    const sockets = new Map();
    sockets.set(socket.id, socket.id);
    const userMap = new Map();
    if (socket.user) userMap.set(socket.id, socket.user.userId);
    rooms.set(roomId, {
      game,
      sockets,
      pendingPlayers: new Map(),
      isPublic: pub,
      roomName: rName,
      createdAt: Date.now(),
      userMap,
    });
    socket.join(roomId);

    socket.emit('roomCreated', { roomId, playerId: socket.id });
    broadcastState(rooms.get(roomId), roomId);
    console.log(`[Room] Created: ${roomId} by ${name} (${pub ? 'public' : 'private'}${rName ? ', name: '+rName : ''})`);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      return socket.emit('error', { message: 'Ingresa tu nombre' });
    }
    const name = playerName.trim().substring(0, 20);
    const rid = roomId?.toUpperCase();
    const room = rooms.get(rid);
    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });

    // Private room: put in pending queue
    if (!room.isPublic) {
      // Check room capacity before adding to pending
      if (room.game.players.length >= 8) {
        return socket.emit('error', { message: 'La sala está llena (máx. 8 jugadores)' });
      }
      if (room.game.state !== 'lobby') {
        return socket.emit('error', { message: 'La partida ya comenzó' });
      }
      // Check name not already in use
      if (room.game.players.find(p => p.name === name)) {
        return socket.emit('error', { message: 'Ese nombre ya está en uso' });
      }
      room.pendingPlayers.set(socket.id, { socketId: socket.id, name });
      socket.emit('joinPending', { roomId: rid, roomName: room.roomName });
      broadcastState(room, rid); // Host gets updated pendingRequests
      console.log(`[Room] ${name} pending approval for ${rid}`);
      return;
    }

    // Public room: direct join
    const result = room.game.addPlayer(socket.id, name);
    if (!result.success) return socket.emit('error', { message: result.error });

    room.sockets.set(socket.id, socket.id);
    if (socket.user) room.userMap.set(socket.id, socket.user.userId);
    socket.join(rid);

    socket.emit('roomCreated', { roomId: rid, playerId: socket.id });
    broadcastState(room, rid);
    console.log(`[Room] ${name} joined ${rid}`);
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
    if (socket.user) room.userMap.set(socket.id, socket.user.userId);
    socket.join(rid);

    socket.emit('roomCreated', { roomId: rid, playerId: socket.id });
    broadcastState(room, rid);
    console.log(`[Room] ${playerName} reconnected to ${rid}`);
  });

  socket.on('setConfig', ({ deckSize, enabledFamilies }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, roomId, playerId } = found;
    if (room.game.hostId !== playerId) return socket.emit('error', { message: 'Solo el anfitrión puede configurar' });
    room.game.setConfig({ deckSize, enabledFamilies });
    broadcastState(room, roomId);
  });

  socket.on('approveJoin', ({ pendingSocketId }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, roomId, playerId } = found;
    if (room.game.hostId !== playerId) return;

    const pending = room.pendingPlayers.get(pendingSocketId);
    if (!pending) return socket.emit('error', { message: 'Solicitud no encontrada' });

    const pendingSock = io.sockets.sockets.get(pendingSocketId);
    if (!pendingSock) {
      room.pendingPlayers.delete(pendingSocketId);
      broadcastState(room, roomId);
      return;
    }

    const result = room.game.addPlayer(pendingSocketId, pending.name);
    if (!result.success) {
      pendingSock.emit('error', { message: result.error });
      return;
    }

    room.pendingPlayers.delete(pendingSocketId);
    room.sockets.set(pendingSocketId, pendingSocketId);
    const pendingSockUser = io.sockets.sockets.get(pendingSocketId)?.user;
    if (pendingSockUser) room.userMap.set(pendingSocketId, pendingSockUser.userId);
    pendingSock.join(roomId);
    pendingSock.emit('roomCreated', { roomId, playerId: pendingSocketId });
    broadcastState(room, roomId);
    console.log(`[Room] ${pending.name} approved into ${roomId}`);
  });

  socket.on('rejectJoin', ({ pendingSocketId }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, roomId, playerId } = found;
    if (room.game.hostId !== playerId) return;

    const pending = room.pendingPlayers.get(pendingSocketId);
    if (!pending) return;

    const pendingSock = io.sockets.sockets.get(pendingSocketId);
    if (pendingSock) {
      pendingSock.emit('joinRejected', { message: `El anfitrión ha rechazado tu solicitud para unirte a "${room.roomName || roomId}"` });
    }
    room.pendingPlayers.delete(pendingSocketId);
    broadcastState(room, roomId);
    console.log(`[Room] ${pending.name} rejected from ${roomId}`);
  });

  socket.on('startGame', () => {
    // config already set via setConfig events; just start
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
          if (gameOver) handleGameEnd(room);
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

    if (result.gameEnd) handleGameEnd(room);
    broadcastState(room, roomId);
    console.log(`[Round] Next round in ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);

    // Clean up pending player status in any room
    for (const [rid, rm] of rooms.entries()) {
      if (rm.pendingPlayers && rm.pendingPlayers.has(socket.id)) {
        rm.pendingPlayers.delete(socket.id);
        broadcastState(rm, rid); // Remove from host's pending list
        break;
      }
    }

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
