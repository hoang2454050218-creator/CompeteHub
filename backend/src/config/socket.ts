import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from './index';
import prisma from './database';
import { redis, createRedisConnection } from './redis';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../utils/jwt';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const socketRateLimits = new Map<string, { count: number; resetAt: number }>();
const SOCKET_RATE_LIMIT = 30;
const SOCKET_RATE_WINDOW = 60_000;

function checkSocketRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = socketRateLimits.get(socketId);
  if (!entry || entry.resetAt < now) {
    socketRateLimits.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= SOCKET_RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of socketRateLimits) {
    if (entry.resetAt < now) socketRateLimits.delete(key);
  }
}, 60_000).unref();

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Yêu cầu đăng nhập'));

    try {
      const decoded = verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Token không hợp lệ'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    socket.on('join:competition', async (competitionId: string) => {
      try {
        if (!checkSocketRateLimit(socket.id)) return;
        if (!competitionId || !UUID_REGEX.test(competitionId)) return;
        if (socket.data.role === 'ADMIN') {
          socket.join(`competition:${competitionId}`);
          return;
        }
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_competitionId: { userId, competitionId } },
        });
        if (enrollment) {
          socket.join(`competition:${competitionId}`);
        }
      } catch (err) {
        logger.error({ err, userId, competitionId }, 'Error joining competition room');
        socket.emit('error', { message: 'Không thể tham gia phòng cuộc thi' });
      }
    });

    socket.on('leave:competition', (competitionId: string) => {
      socket.leave(`competition:${competitionId}`);
    });

    socket.on('join:leaderboard', async (competitionId: string) => {
      try {
        if (!checkSocketRateLimit(socket.id)) return;
        if (!competitionId || !UUID_REGEX.test(competitionId)) return;
        if (socket.data.role === 'ADMIN') {
          socket.join(`leaderboard:${competitionId}`);
          return;
        }
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_competitionId: { userId, competitionId } },
        });
        if (enrollment) {
          socket.join(`leaderboard:${competitionId}`);
        }
      } catch (err) {
        logger.error({ err, userId, competitionId }, 'Error joining leaderboard room');
        socket.emit('error', { message: 'Không thể tham gia phòng bảng xếp hạng' });
      }
    });

    socket.on('error', (err) => {
      logger.error({ err, userId }, 'Socket error');
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    });
  });

  const subscriber = createRedisConnection();
  subscriber.subscribe('scoring:complete', (err) => {
    if (err) logger.error({ err }, 'Failed to subscribe to scoring:complete');
    else logger.info('Subscribed to scoring:complete channel');
  });
  subscriber.on('message', (_channel, message) => {
    try {
      const data = JSON.parse(message);
      io.to(`leaderboard:${data.competitionId}`).emit('leaderboard:updated', {
        competitionId: data.competitionId,
        userId: data.userId,
        publicScore: data.publicScore,
      });
      io.to(`user:${data.userId}`).emit('submission:scored', {
        submissionId: data.submissionId,
        publicScore: data.publicScore,
        privateScore: data.privateScore,
      });
    } catch (err) {
      logger.error({ err }, 'Error processing scoring:complete message');
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
