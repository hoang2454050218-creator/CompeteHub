import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { stripHtmlTags } from '../../utils/fileHelpers';

export class UserService {
  async getProfile(userId: string, isOwnProfile = false) {
    const select: Record<string, boolean | object> = {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      githubUrl: true,
      linkedinUrl: true,
      role: true,
      createdAt: true,
      _count: { select: { enrollments: true, submissions: true } },
    };
    if (isOwnProfile) {
      select.email = true;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    const competitionHistory = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        competition: {
          select: { id: true, title: true, slug: true, status: true, evalMetric: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const bestResults = await prisma.leaderboardEntry.findMany({
      where: { userId },
      select: {
        bestPublicScore: true,
        submissionCount: true,
        lastSubmittedAt: true,
        publicRank: true,
        competition: { select: { id: true, title: true, slug: true, status: true } },
      },
      orderBy: { bestPublicScore: 'desc' },
      take: 10,
    });

    return { ...user, competitionHistory, bestResults };
  }

  async updateProfile(userId: string, data: { name?: string; bio?: string; avatarUrl?: string; githubUrl?: string; linkedinUrl?: string }) {
    const sanitized = { ...data };
    if (typeof sanitized.name === 'string') sanitized.name = stripHtmlTags(sanitized.name);
    if (typeof sanitized.bio === 'string') sanitized.bio = stripHtmlTags(sanitized.bio);
    return prisma.user.update({
      where: { id: userId },
      data: sanitized,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        bio: true,
        githubUrl: true,
        linkedinUrl: true,
        role: true,
      },
    });
  }
}
