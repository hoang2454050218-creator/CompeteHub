import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { processScoring, ScoringJob } from './processor';

let worker: Worker<ScoringJob> | null = null;
let dlq: Queue | null = null;
let workerConnection: Redis | null = null;
let dlqConnection: Redis | null = null;

export function startInlineWorker() {
  if (worker) {
    logger.warn('Inline scoring worker already started');
    return;
  }

  workerConnection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  workerConnection.on('error', (err) => {
    logger.error({ err: err.message }, 'Worker Redis connection error');
  });

  dlqConnection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  dlq = new Queue('scoring-dlq', { connection: dlqConnection });

  worker = new Worker<ScoringJob>(
    'scoring',
    async (job) => {
      logger.info(
        { jobId: job.id, submissionId: job.data.submissionId, attempt: job.attemptsMade + 1 },
        'Processing scoring job'
      );
      const result = await processScoring(job.data);
      logger.info({ jobId: job.id, publicScore: result.publicScore }, 'Scoring job completed');
      return result;
    },
    {
      connection: workerConnection,
      concurrency: 2,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      lockDuration: 300_000,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', async (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message, attempts: job?.attemptsMade },
      'Job failed'
    );

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1) && dlq) {
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

  logger.info('Inline scoring worker started');
}

export async function stopInlineWorker() {
  if (!worker) return;
  try {
    await worker.close();
    logger.info('Inline worker drained and closed');
  } catch (err) {
    logger.error({ err }, 'Error closing inline worker');
  }
  try {
    await dlq?.close();
    workerConnection?.disconnect();
    dlqConnection?.disconnect();
  } catch (err) {
    logger.error({ err }, 'Error closing inline worker Redis');
  }
  worker = null;
  dlq = null;
  workerConnection = null;
  dlqConnection = null;
}
