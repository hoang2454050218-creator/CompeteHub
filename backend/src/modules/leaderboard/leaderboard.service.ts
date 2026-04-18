import prisma from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { EvalMetric } from '@prisma/client';
import { leaderboardCacheTotal } from '../../config/metrics';

const LOWER_IS_BETTER = new Set<EvalMetric>(['RMSE', 'LOG_LOSS']);

export class LeaderboardService {
  private async getSortDirection(competitionId: string): Promise<'asc' | 'desc'> {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { evalMetric: true },
    });
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    return LOWER_IS_BETTER.has(competition.evalMetric) ? 'asc' : 'desc';
  }

  async getPublicLeaderboard(competitionId: string, page = 1, limit = 50) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);

    if (page === 1 && cappedLimit === 50) {
      const cacheKey = `leaderboard:cache:${competitionId}:public`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          leaderboardCacheTotal.inc({ result: 'hit' });
          return parsed;
        } catch {
          leaderboardCacheTotal.inc({ result: 'parse_error' });
        }
      } else {
        leaderboardCacheTotal.inc({ result: 'miss' });
      }
    }

    const sortDir = await this.getSortDirection(competitionId);
    const [data, total] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where: { competitionId },
        orderBy: { bestPublicScore: sortDir },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        select: {
          id: true,
          bestPublicScore: true,
          submissionCount: true,
          lastSubmittedAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.leaderboardEntry.count({ where: { competitionId } }),
    ]);

    const ranked = this.assignTiedRanks(data, 'bestPublicScore', (page - 1) * cappedLimit);

    const result = {
      data: ranked,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };

    if (page === 1 && cappedLimit === 50) {
      const cacheKey = `leaderboard:cache:${competitionId}:public`;
      await redis.setex(cacheKey, 120, JSON.stringify(result));
    }

    return result;
  }

  async getPrivateLeaderboard(competitionId: string, page = 1, limit = 50) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    if (competition.status !== 'COMPLETED' && competition.status !== 'ARCHIVED') {
      throw new AppError('Bảng xếp hạng riêng chỉ khả dụng sau khi cuộc thi kết thúc', 403);
    }

    const sortDir = LOWER_IS_BETTER.has(competition.evalMetric) ? 'asc' : 'desc';
    const [data, total] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where: { competitionId },
        orderBy: { bestPrivateScore: sortDir },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        select: {
          id: true,
          bestPublicScore: true,
          bestPrivateScore: true,
          submissionCount: true,
          lastSubmittedAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.leaderboardEntry.count({ where: { competitionId } }),
    ]);

    const ranked = this.assignTiedRanks(data, 'bestPrivateScore', (page - 1) * cappedLimit);

    return {
      data: ranked,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async getShakeup(competitionId: string, limit = 200) {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    if (competition.status !== 'COMPLETED' && competition.status !== 'ARCHIVED') {
      throw new AppError('Phân tích biến động thứ hạng chỉ khả dụng sau khi cuộc thi kết thúc', 403);
    }

    const cappedLimit = Math.min(Math.max(1, limit), 500);
    const sortDir = LOWER_IS_BETTER.has(competition.evalMetric) ? 'asc' : 'desc';
    const entries = await prisma.leaderboardEntry.findMany({
      where: { competitionId },
      orderBy: { bestPublicScore: sortDir },
      take: cappedLimit,
      select: {
        id: true,
        bestPublicScore: true,
        bestPrivateScore: true,
        submissionCount: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
    });

    const factor = LOWER_IS_BETTER.has(competition.evalMetric) ? 1 : -1;
    const publicSorted = [...entries].sort((a, b) => factor * ((a.bestPublicScore || 0) - (b.bestPublicScore || 0)));
    const privateSorted = [...entries].sort((a, b) => factor * ((a.bestPrivateScore || 0) - (b.bestPrivateScore || 0)));

    const publicRankMap = new Map<string, number>();
    const privateRankMap = new Map<string, number>();
    publicSorted.forEach((e, idx) => publicRankMap.set(e.id, idx + 1));
    privateSorted.forEach((e, idx) => privateRankMap.set(e.id, idx + 1));

    return entries.map((entry) => {
      const publicRank = publicRankMap.get(entry.id)!;
      const privateRank = privateRankMap.get(entry.id)!;
      return { ...entry, publicRank, privateRank, rankChange: publicRank - privateRank };
    }).sort((a, b) => a.privateRank - b.privateRank);
  }

  async exportCsv(competitionId: string, userId: string, isAdmin = false) {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    // AUDIT-FIX M-09: admin bypass to match route-level authorization intent
    if (!isAdmin && competition.hostId !== userId && competition.status !== 'COMPLETED' && competition.status !== 'ARCHIVED') {
      throw new AppError('Bạn không có quyền thực hiện thao tác này', 403);
    }

    const showPrivate = competition.status === 'COMPLETED' || competition.status === 'ARCHIVED';

    const exportSortDir = LOWER_IS_BETTER.has(competition.evalMetric) ? 'asc' as const : 'desc' as const;
    const entries = await prisma.leaderboardEntry.findMany({
      where: { competitionId },
      orderBy: { bestPublicScore: exportSortDir },
      select: {
        bestPublicScore: true,
        bestPrivateScore: showPrivate,
        submissionCount: true,
        lastSubmittedAt: true,
        user: { select: { name: true } },
        team: { select: { name: true } },
      },
    });

    const headers = showPrivate
      ? ['Hạng', 'Người dùng', 'Đội', 'Điểm công khai', 'Điểm riêng tư', 'Số lượt nộp', 'Lần nộp gần nhất']
      : ['Hạng', 'Người dùng', 'Đội', 'Điểm công khai', 'Số lượt nộp', 'Lần nộp gần nhất'];

    const rows = entries.map((entry, idx) => {
      const base: (string | number)[] = [
        idx + 1,
        entry.user.name,
        entry.team?.name || '',
        entry.bestPublicScore ?? '',
      ];
      if (showPrivate) base.push(entry.bestPrivateScore ?? '');
      base.push(entry.submissionCount, entry.lastSubmittedAt?.toISOString() || '');
      return base;
    });

    return [headers, ...rows]
      .map((row) => row.map((cell) => {
        let val = String(cell).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
        if (/^[=+\-@\t\r]/.test(val)) val = `'${val}`;
        return `"${val}"`;
      }).join(','))
      .join('\n');
  }

  private assignTiedRanks<T extends Record<string, unknown>>(
    entries: T[],
    scoreField: string,
    offset: number
  ): (T & { rank: number })[] {
    let currentRank = offset + 1;
    return entries.map((entry, idx) => {
      if (idx > 0) {
        const prev = entries[idx - 1][scoreField] as number | null;
        const curr = entry[scoreField] as number | null;
        if (prev !== curr) {
          currentRank = offset + idx + 1;
        }
      }
      return { ...entry, rank: currentRank };
    });
  }

  async updateLeaderboard(
    competitionId: string,
    userId: string,
    teamId: string | null,
    publicScore: number,
    privateScore: number,
    higherIsBetter = true
  ) {
    const compareBest = (existing: number | null, incoming: number) => {
      if (existing === null) return incoming;
      return higherIsBetter
        ? Math.max(existing, incoming)
        : Math.min(existing, incoming);
    };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.leaderboardEntry.findUnique({
        where: { competitionId_userId: { competitionId, userId } },
      });

      const bestPublic = compareBest(existing?.bestPublicScore ?? null, publicScore);
      const bestPrivate = compareBest(existing?.bestPrivateScore ?? null, privateScore);

      await tx.leaderboardEntry.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        update: {
          bestPublicScore: bestPublic,
          bestPrivateScore: bestPrivate,
          teamId,
          submissionCount: { increment: 1 },
          lastSubmittedAt: new Date(),
        },
        create: {
          competitionId,
          userId,
          teamId,
          bestPublicScore: bestPublic,
          bestPrivateScore: bestPrivate,
          submissionCount: 1,
          lastSubmittedAt: new Date(),
        },
      });
    }, { isolationLevel: 'Serializable' });

    const sortPublic = higherIsBetter ? publicScore : -publicScore;
    const sortPrivate = higherIsBetter ? privateScore : -privateScore;
    await redis.zadd(`leaderboard:${competitionId}:public`, sortPublic, userId);
    await redis.zadd(`leaderboard:${competitionId}:private`, sortPrivate, userId);

    await redis.del(`leaderboard:cache:${competitionId}:public`);
  }
}
