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

let chatSocket: Socket | null = null;
let chatToken: string | null = null;

export function getChatSocket(token: string): Socket {
  if (chatSocket && chatToken === token) {
    return chatSocket;
  }
  if (chatSocket) {
    chatSocket.disconnect();
  }
  chatToken = token;
  chatSocket = io(`${apiBaseUrl}/chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  return chatSocket;
}

export function disconnectChatSocket(): void {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
    chatToken = null;
  }
}
