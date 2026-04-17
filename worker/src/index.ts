import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import pino from 'pino';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { processScoring, ScoringJob } from './processor';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const required = ['DATABASE_URL', 'REDIS_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`FATAL: Missing required env var: ${key}`);
    }
  }
  if (process.env.MINIO_ACCESS_KEY === 'minioadmin') {
    throw new Error('FATAL: MINIO_ACCESS_KEY must not use default credentials in production');
  }
}

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'refreshToken',
  'accessToken',
  'secret',
  'MINIO_SECRET_KEY',
  'MINIO_ACCESS_KEY',
];

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }),
});

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis connection error');
});

const dlqConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const dlq = new Queue('scoring-dlq', { connection: dlqConnection });

const worker = new Worker<ScoringJob>(
  'scoring',
  async (job) => {
    logger.info({ jobId: job.id, submissionId: job.data.submissionId, attempt: job.attemptsMade + 1 }, 'Processing scoring job');
    const result = await processScoring(job.data);
    logger.info(
      { jobId: job.id, publicScore: result.publicScore },
      'Scoring job completed'
    );
    return result;
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    lockDuration: 300_000,
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'Job failed');

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    logger.warn({ jobId: job.id }, 'Job exhausted all retries, moving to DLQ');
    try {
      await dlq.add('dead-job', {
        originalJobId: job.id,
        data: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      });
    } catch (dlqErr) {
      logger.error({ err: dlqErr }, 'Failed to push to DLQ');
    }
  }
});

worker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Scoring job stalled — will be retried');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker error');
});

logger.info('Scoring worker started, waiting for jobs...');

let isHealthy = true;

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, draining worker...');
  isHealthy = false;
  try {
    await worker.close();
    logger.info('Worker drained and closed');
  } catch (err) {
    logger.error({ err }, 'Error closing worker');
  }
  try {
    await dlq.close();
    connection.disconnect();
    dlqConnection.disconnect();
    logger.info('Redis connections closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis');
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException').finally(() => process.exit(1));
});

const healthPort = parseInt(process.env.WORKER_HEALTH_PORT || '3001', 10);
const healthServer = http.createServer(async (_req, res) => {
  if (!isHealthy) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'draining' }));
    return;
  }
  try {
    await connection.ping();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'unhealthy', reason: 'redis unreachable' }));
  }
});
healthServer.listen(healthPort, () => {
  logger.info({ port: healthPort }, 'Worker health check listening');
});
