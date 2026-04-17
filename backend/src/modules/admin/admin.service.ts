import prisma from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { CompetitionStatus, Role, Prisma } from '@prisma/client';

const DASHBOARD_CACHE_KEY = 'admin:dashboard';
const DASHBOARD_CACHE_TTL = 60;

export class AdminService {
  async getDashboard() {
    const cached = await redis.get(DASHBOARD_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { /* ignore corrupt cache */ }
    }

    const [totalUsers, totalCompetitions, totalSubmissions, activeCompetitions, recentUsers, submissionsByDay] = await Promise.all([
      prisma.user.count(),
      prisma.competition.count(),
      prisma.submission.count(),
      prisma.competition.count({ where: { status: 'ACTIVE' } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*)::bigint as count
        FROM submissions
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    const pendingReview = await prisma.competition.count({ where: { status: 'PENDING_REVIEW' } });

    const result = {
      stats: { totalUsers, totalCompetitions, totalSubmissions, activeCompetitions, pendingReview },
      recentUsers,
      submissionsByDay: submissionsByDay.map((d) => ({ date: d.date, count: Number(d.count) })),
    };

    await redis.setex(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async reviewCompetition(competitionId: string, action: 'approve' | 'reject') {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (competition.status !== 'PENDING_REVIEW') {
      throw new AppError('Competition is not pending review', 400);
    }

    const newStatus: CompetitionStatus = action === 'approve' ? 'ACTIVE' : 'DRAFT';
    return prisma.competition.update({
      where: { id: competitionId },
      data: { status: newStatus },
    });
  }

  async listUsers(page = 1, limit = 20, search?: string, role?: Role) {
    limit = Math.min(Math.max(1, limit), 100);
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { submissions: true, enrollments: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateUser(userId: string, data: { role?: Role; isActive?: boolean }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }
}
