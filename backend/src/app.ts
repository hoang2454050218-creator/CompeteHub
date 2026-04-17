import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';

import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { initSentry, Sentry } from './config/sentry';
import { initPassport } from './config/passport';
import { initSocket, getIO } from './config/socket';
import { ensureBucket } from './config/minio';
import { redis } from './config/redis';
import { initZodErrorMap } from './config/zod';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection } from './middleware/csrf';
import { swaggerSpec } from './config/swagger';
import { logger } from './utils/logger';
import prisma from './config/database';

import authRoutes from './modules/auth/auth.routes';
import competitionRoutes from './modules/competition/competition.routes';
import datasetRoutes from './modules/dataset/dataset.routes';
import enrollmentRoutes from './modules/enrollment/enrollment.routes';
import submissionRoutes from './modules/submission/submission.routes';
import leaderboardRoutes from './modules/leaderboard/leaderboard.routes';
import discussionRoutes from './modules/discussion/discussion.routes';
import teamRoutes from './modules/team/team.routes';
import notificationRoutes from './modules/notification/notification.routes';
import userRoutes from './modules/user/user.routes';
import { recoverStuckSubmissions, autoCompleteCompetitions, cleanupOldNotifications } from './jobs/scheduledJobs';
import adminRoutes from './modules/admin/admin.routes';
import { startInlineWorker, stopInlineWorker } from './worker';

initSentry();
initZodErrorMap();

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

// AUDIT-FIX: Explicit CSP and security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', config.frontendUrl],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(csrfProtection);

app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

const redisSendCommand = (...args: string[]) =>
  (redis as any).call(...args) as any;

// AUDIT-FIX F-Sec-01: Pick the original client IP from the leftmost X-Forwarded-For
// hop (set by trusted upstream nginx). Without this, express-rate-limit defaults to
// req.ip which under docker resolves to the nginx container IP -> ALL clients share
// one rate-limit bucket.
function clientIpKey(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

const rateLimitStore = new RedisStore({ sendCommand: redisSendCommand });
const rateLimitResponse = {
  success: false,
  data: null,
  message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
  errorCode: 'RATE_LIMITED',
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  keyGenerator: clientIpKey,
});
app.use('/api/', globalLimiter);

const authRateLimitStore = new RedisStore({
  sendCommand: redisSendCommand,
  prefix: 'rl:auth:',
});

// AUDIT-FIX: Tighter rate limits for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
  store: authRateLimitStore,
  keyGenerator: clientIpKey,
});

const registerLimiterStore = new RedisStore({
  sendCommand: redisSendCommand,
  prefix: 'rl:register:',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
  store: registerLimiterStore,
  keyGenerator: clientIpKey,
});

initPassport();
app.use(passport.initialize());

const API = '/api/v1';
const refreshLimiterStore = new RedisStore({
  sendCommand: redisSendCommand,
  prefix: 'rl:refresh:',
});
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
  store: refreshLimiterStore,
  keyGenerator: clientIpKey,
});

app.use(`${API}/auth/login`, loginLimiter);
app.use(`${API}/auth/register`, registerLimiter);
app.use(`${API}/auth/forgot-password`, loginLimiter);
app.use(`${API}/auth/reset-password`, loginLimiter);
app.use(`${API}/auth/refresh`, refreshLimiter);
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/competitions`, competitionRoutes);
app.use(`${API}/competitions`, datasetRoutes);
app.use(`${API}/competitions`, enrollmentRoutes);
app.use(`${API}/competitions`, submissionRoutes);
app.use(`${API}/competitions`, leaderboardRoutes);
app.use(`${API}/competitions`, discussionRoutes);
app.use(`${API}/teams`, teamRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/admin`, adminRoutes);

if (config.nodeEnv !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.get('/api/health', async (req, res) => {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  try {
    const { minioClient } = await import('./config/minio');
    await minioClient.bucketExists(config.minio.bucket);
    checks.minio = 'ok';
  } catch {
    checks.minio = 'error';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok');
  const statusCode = allHealthy ? 200 : 503;

  const isInternal = req.ip === '127.0.0.1' || req.ip === '::1' ||
    req.headers['x-forwarded-for'] === undefined;

  res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    ...(isInternal ? { checks } : {}),
  });
});

app.use(errorHandler);

initSocket(httpServer);

async function start() {
  try {
    await ensureBucket();
    logger.info('MinIO bucket ready');
  } catch (err) {
    logger.warn({ err }, 'MinIO not available, file storage will fail');
  }

  // AUDIT-FIX: Scheduled jobs for stuck submissions and auto-completion
  cron.schedule('*/5 * * * *', recoverStuckSubmissions);
  cron.schedule('*/5 * * * *', autoCompleteCompetitions);
  cron.schedule('0 3 * * *', cleanupOldNotifications);
  recoverStuckSubmissions().catch((err) => logger.error({ err }, 'Startup recovery failed'));

  if (process.env.WORKER_INLINE === 'true') {
    startInlineWorker();
  }

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, `Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received, closing gracefully...');

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    const io = getIO();
    io.close();
    logger.info('Socket.IO closed');
  } catch { /* not initialized */ }

  await stopInlineWorker();

  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis');
  }

  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting database');
  }

  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception, shutting down...');
  Sentry.captureException(err);
  shutdown('uncaughtException').finally(() => process.exit(1));
});

export default app;
