import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { NextFunction, Request, Response } from 'express';
import type { Queue } from 'bullmq';
import { logger } from '../utils/logger';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'backend' });
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const authFailedLoginTotal = new Counter({
  name: 'auth_failed_login_total',
  help: 'Total number of failed login attempts',
  labelNames: ['reason'] as const,
  registers: [registry],
});

export const leaderboardCacheTotal = new Counter({
  name: 'leaderboard_cache_total',
  help: 'Leaderboard cache lookups',
  labelNames: ['result'] as const,
  registers: [registry],
});

export const submissionUploadTotal = new Counter({
  name: 'submission_upload_total',
  help: 'Total submissions uploaded',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const bullmqQueueDepth = new Gauge({
  name: 'bullmq_queue_depth',
  help: 'Current depth of BullMQ queues by state',
  labelNames: ['queue', 'state'] as const,
  registers: [registry],
});

export const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of active Socket.IO connections',
  registers: [registry],
});

const NORMALISE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function normaliseRoute(req: Request): string {
  const route = (req.route?.path as string) || (req.baseUrl + (req.path || '')) || req.originalUrl || 'unknown';
  return route.replace(NORMALISE_UUID, ':id');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/metrics') return next();
  const stop = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: normaliseRoute(req),
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    stop(labels);
  });
  next();
}

const QUEUE_STATES = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;

export function startQueueDepthCollector(queues: Queue[], intervalMs = 15_000) {
  if (queues.length === 0) return () => undefined;
  const tick = async () => {
    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts(...QUEUE_STATES);
        for (const state of QUEUE_STATES) {
          bullmqQueueDepth.set({ queue: queue.name, state }, counts[state] ?? 0);
        }
      } catch (err) {
        logger.debug({ err, queue: queue.name }, 'Failed to read queue depth');
      }
    }
  };
  void tick();
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}
