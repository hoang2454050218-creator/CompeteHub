import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'worker' });
collectDefaultMetrics({ register: registry });

export const scoringJobsTotal = new Counter({
  name: 'worker_scoring_jobs_total',
  help: 'Total scoring jobs processed by outcome',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const scoringDurationSeconds = new Histogram({
  name: 'worker_scoring_duration_seconds',
  help: 'Duration of scoring jobs in seconds',
  labelNames: ['metric'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

export const scoringRowsProcessed = new Histogram({
  name: 'worker_scoring_rows_processed',
  help: 'Number of rows processed per scoring job',
  buckets: [100, 1000, 10_000, 100_000, 1_000_000, 5_000_000],
  registers: [registry],
});

export const dlqDepth = new Gauge({
  name: 'worker_dlq_depth',
  help: 'Current DLQ depth',
  registers: [registry],
});

export const workerHealthy = new Gauge({
  name: 'worker_healthy',
  help: '1 if worker is accepting jobs, 0 if draining',
  registers: [registry],
});
