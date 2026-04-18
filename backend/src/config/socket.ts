import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './index';
import prisma from './database';
import { redis, createRedisConnection } from './redis';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../utils/jwt';
import { websocketConnections } from './metrics';
import { BadgeService } from '../modules/badge/badge.service';

const badgeService = new BadgeService();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOCKET_RATE_LIMIT = 30;
const SOCKET_RATE_WINDOW_SECONDS = 60;

async function checkSocketRateLimit(userId: string): Promise<boolean> {
  const key = `sock:rl:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, SOCKET_RATE_WINDOW_SECONDS);
  }
  return count <= SOCKET_RATE_LIMIT;
}

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

  const pubClient = createRedisConnection();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

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
    websocketConnections.inc();

    socket.on('join:competition', async (competitionId: string) => {
      try {
        if (!(await checkSocketRateLimit(userId))) return;
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
        if (!(await checkSocketRateLimit(userId))) return;
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
      websocketConnections.dec();
    });
  });

  const subscriber = createRedisConnection();
  subscriber.subscribe('scoring:complete', (err) => {
    if (err) logger.error({ err }, 'Failed to subscribe to scoring:complete');
    else logger.info('Subscribed to scoring:complete channel');
  });
  subscriber.subscribe('discussion:new', (err) => {
    if (err) logger.error({ err }, 'Failed to subscribe to discussion:new');
  });
  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === 'scoring:complete') {
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
        void badgeService.evaluate({
          kind: 'submission_scored',
          userId: data.userId,
          competitionId: data.competitionId,
        });
        return;
      }
      if (channel === 'discussion:new') {
        io.to(`competition:${data.competitionId}`).emit('discussion:new', {
          competitionId: data.competitionId,
          discussionId: data.discussionId,
          replyId: data.replyId,
          kind: data.kind,
        });
      }
    } catch (err) {
      logger.error({ err, channel }, 'Error processing pub/sub message');
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
