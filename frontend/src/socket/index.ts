import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!token || socket?.connected) return;

  socket = io(import.meta.env.VITE_WS_URL || window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 20,
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'jwt expired' || err.message === 'Invalid token' || err.message === 'unauthorized') {
      const currentToken = useAuthStore.getState().accessToken;
      if (currentToken && socket) {
        socket.auth = { token: currentToken };
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            socket?.connect();
          }, 1000);
        }
      } else {
        disconnectSocket();
      }
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinCompetition(competitionId: string) {
  socket?.emit('join:competition', competitionId);
}

export function leaveCompetition(competitionId: string) {
  socket?.emit('leave:competition', competitionId);
}

export function joinLeaderboard(competitionId: string) {
  socket?.emit('join:leaderboard', competitionId);
}
