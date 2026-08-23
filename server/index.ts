import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.js';
import type { ClientMessage } from '../shared/protocol.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const room = new GameRoom();

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

wss.on('connection', (socket) => {
  room.addConnection(socket);

  socket.on('message', (rawMessage) => {
    try {
      room.handleMessage(socket, JSON.parse(rawMessage.toString()) as ClientMessage);
    } catch {
      socket.send(JSON.stringify({ type: 'ACTION_REJECTED', message: 'Invalid message.' }));
    }
  });

  socket.on('close', () => {
    room.removeConnection(socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Ticket to Ride Greece server listening on http://${HOST}:${PORT}`);
});
