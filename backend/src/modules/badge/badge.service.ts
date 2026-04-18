import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

export type BadgeTrigger =
  | { kind: 'submission_scored'; userId: string; competitionId: string }
  | { kind: 'vote_received'; userId: string; upvoteCount: number }
  | { kind: 'email_verified'; userId: string }
  | { kind: 'mfa_enabled'; userId: string }
  | { kind: 'leaderboard_finalized'; userId: string; competitionId: string; rank: number };

const SUBMISSION_BADGES: Array<{ code: string; threshold: number }> = [
  { code: 'FIRST_SUBMISSION', threshold: 1 },
  { code: 'TEN_SUBMISSIONS', threshold: 10 },
  { code: 'HUNDRED_SUBMISSIONS', threshold: 100 },
  { code: 'THOUSAND_SUBMISSIONS', threshold: 1000 },
];

export class BadgeService {
  async listForUser(userId: string) {
    return prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
      include: { badge: true },
    });
  }

  async listAll() {
    return prisma.badge.findMany({ orderBy: { code: 'asc' } });
  }

  async award(userId: string, code: string, metadata?: Record<string, unknown>): Promise<boolean> {
    const badge = await prisma.badge.findUnique({ where: { code } });
    if (!badge) return false;

    try {
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          metadata: (metadata as object | undefined) ?? undefined,
        },
      });
      try {
        await notificationService.create(
          userId,
          'BADGE_AWARDED',
          'Bạn vừa nhận huy hiệu mới',
          `Chúc mừng! Bạn đã được trao huy hiệu "${badge.name}".`,
          'badge',
          badge.id
        );
      } catch (err) {
        logger.warn({ err }, 'Badge notification failed');
      }
      return true;
    } catch {
      return false;
    }
  }

  async evaluate(trigger: BadgeTrigger) {
    try {
      switch (trigger.kind) {
        case 'submission_scored': {
          const count = await prisma.submission.count({
            where: { userId: trigger.userId, status: 'SCORED' },
          });
          for (const { code, threshold } of SUBMISSION_BADGES) {
            if (count >= threshold) await this.award(trigger.userId, code, { count });
          }
          return;
        }
        case 'vote_received': {
          if (trigger.upvoteCount >= 10) {
            await this.award(trigger.userId, 'HELPFUL', { upvoteCount: trigger.upvoteCount });
          }
          return;
        }
        case 'email_verified': {
          await this.award(trigger.userId, 'EMAIL_VERIFIED');
          return;
        }
        case 'mfa_enabled': {
          await this.award(trigger.userId, 'MFA_ENABLED');
          return;
        }
        case 'leaderboard_finalized': {
          if (trigger.rank === 1) {
            await this.award(trigger.userId, 'COMPETITION_WINNER', { competitionId: trigger.competitionId });
          } else if (trigger.rank <= 10) {
            await this.award(trigger.userId, 'TOP_10', { competitionId: trigger.competitionId });
          }
          return;
        }
      }
    } catch (err) {
      logger.error({ err, trigger }, 'Badge evaluation failed');
    }
  }
}
