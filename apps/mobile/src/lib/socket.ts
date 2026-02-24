import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from '../config/env';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getMatchSocket(token: string): Socket {
  if (socket && currentToken === token) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }
  currentToken = token;
  socket = io(`${apiBaseUrl}/matches`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  return socket;
}

export function disconnectMatchSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
