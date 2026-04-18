import prisma from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../modules/notification/notification.service';

const notificationService = new NotificationService();

const STUCK_TIMEOUT_MS = 10 * 60 * 1000;
const LOCK_TTL_SECONDS = 120;

async function acquireLock(name: string): Promise<boolean> {
  const result = await redis.set(`lock:${name}`, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  return result === 'OK';
}

async function releaseLock(name: string) {
  await redis.del(`lock:${name}`);
}

export async function recoverStuckSubmissions() {
  if (!(await acquireLock('recover-stuck'))) return;
  try {
    const threshold = new Date(Date.now() - STUCK_TIMEOUT_MS);
    const result = await prisma.submission.updateMany({
      where: {
        status: 'SCORING',
        createdAt: { lt: threshold },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Scoring timed out after 10 minutes. Please resubmit.',
      },
    });
    if (result.count > 0) {
      logger.warn({ count: result.count }, 'Recovered stuck submissions');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to recover stuck submissions');
  } finally {
    await releaseLock('recover-stuck');
  }
}

export async function autoCompleteCompetitions() {
  if (!(await acquireLock('auto-complete'))) return;
  try {
    const expiredCompetitions = await prisma.competition.findMany({
      where: { status: 'ACTIVE', endDate: { lt: new Date() } },
      select: { id: true, evalMetric: true },
    });

    if (expiredCompetitions.length === 0) return;

    await prisma.competition.updateMany({
      where: { id: { in: expiredCompetitions.map((c) => c.id) } },
      data: { status: 'COMPLETED' },
    });

    const LOWER_IS_BETTER_METRICS = new Set(['RMSE', 'LOG_LOSS']);

    for (const comp of expiredCompetitions) {
      try {
        await autoSelectBestSubmissions(comp.id, LOWER_IS_BETTER_METRICS.has(comp.evalMetric));
      } catch (err) {
        logger.error({ err, competitionId: comp.id }, 'Failed to auto-select submissions');
      }
    }

    logger.info({ count: expiredCompetitions.length }, 'Auto-completed expired competitions');
  } catch (err) {
    logger.error({ err }, 'Failed to auto-complete competitions');
  } finally {
    await releaseLock('auto-complete');
  }
}

async function autoSelectBestSubmissions(competitionId: string, lowerIsBetter: boolean) {
  const orderDirection = lowerIsBetter ? 'ASC' : 'DESC';
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe(
      `
      WITH best_per_user AS (
        SELECT DISTINCT ON (user_id) id
        FROM submissions
        WHERE competition_id = $1
          AND status = 'SCORED'
          AND private_score IS NOT NULL
          AND user_id NOT IN (
            SELECT DISTINCT user_id
            FROM submissions
            WHERE competition_id = $1 AND is_selected = true
          )
        ORDER BY user_id, private_score ${orderDirection} NULLS LAST, scored_at ASC
      )
      UPDATE submissions
      SET is_selected = true
      WHERE id IN (SELECT id FROM best_per_user)
      `,
      competitionId
    );
    if (updated > 0) {
      logger.info({ competitionId, count: updated }, 'Auto-selected best submissions');
    }
  }, { isolationLevel: 'Serializable' });
}

export async function cleanupOldNotifications() {
  if (!(await acquireLock('cleanup-notifications'))) return;
  try {
    const result = await notificationService.cleanupOld(90);
    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up old notifications');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to cleanup notifications');
  } finally {
    await releaseLock('cleanup-notifications');
  }
}
