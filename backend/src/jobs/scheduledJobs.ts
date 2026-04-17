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
  const usersWithSelected = await prisma.submission.findMany({
    where: { competitionId, isSelected: true },
    distinct: ['userId'],
    select: { userId: true },
  });
  const alreadySelectedUserIds = new Set(usersWithSelected.map((s) => s.userId));

  const participants = await prisma.submission.findMany({
    where: { competitionId, status: 'SCORED', isSelected: false },
    distinct: ['userId'],
    select: { userId: true },
  });

  const unselectedUserIds = participants
    .map((p) => p.userId)
    .filter((uid) => !alreadySelectedUserIds.has(uid));

  if (unselectedUserIds.length === 0) return;

  const bestSubmissions = await prisma.submission.findMany({
    where: { competitionId, status: 'SCORED', userId: { in: unselectedUserIds } },
    orderBy: { privateScore: lowerIsBetter ? 'asc' : 'desc' },
    distinct: ['userId'],
    select: { id: true },
  });

  if (bestSubmissions.length > 0) {
    await prisma.submission.updateMany({
      where: { id: { in: bestSubmissions.map((s) => s.id) } },
      data: { isSelected: true },
    });
  }
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
