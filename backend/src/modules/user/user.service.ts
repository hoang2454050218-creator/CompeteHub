import bcrypt from 'bcryptjs';
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
      followerCount: true,
      followingCount: true,
      _count: { select: { enrollments: true, submissions: true, badges: true } },
    };
    if (isOwnProfile) {
      select.email = true;
      select.emailVerified = true;
      select.totpEnabled = true;
      select.notificationPreferences = true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select,
    });
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

    const badges = await prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
      include: { badge: true },
      take: 50,
    });

    return { ...user, competitionHistory, bestResults, badges };
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

  async updateNotificationPreferences(userId: string, prefs: Record<string, boolean>) {
    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: prefs },
    });
  }

  async exportUserData(userId: string) {
    const [user, enrollments, submissions, votes, notifications, discussions, replies, ledTeams, sentInvitations, receivedInvitations, leaderboardEntries, badges, follows, auditLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, avatarUrl: true, bio: true,
          githubUrl: true, linkedinUrl: true, role: true, isActive: true,
          emailVerified: true, totpEnabled: true, followerCount: true, followingCount: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.enrollment.findMany({ where: { userId } }),
      prisma.submission.findMany({ where: { userId } }),
      prisma.vote.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.discussion.findMany({ where: { authorId: userId } }),
      prisma.discussionReply.findMany({ where: { authorId: userId } }),
      prisma.team.findMany({ where: { leaderId: userId } }),
      prisma.teamInvitation.findMany({ where: { senderId: userId } }),
      prisma.teamInvitation.findMany({ where: { receiverId: userId } }),
      prisma.leaderboardEntry.findMany({ where: { userId } }),
      prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }),
      prisma.follow.findMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      prisma.auditLog.findMany({ where: { actorId: userId } }),
    ]);

    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    return {
      exportedAt: new Date().toISOString(),
      user,
      enrollments,
      submissions,
      votes,
      notifications,
      discussions,
      replies,
      ledTeams,
      sentInvitations,
      receivedInvitations,
      leaderboardEntries,
      badges,
      follows,
      auditLogs,
    };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    if (!user.passwordHash) {
      throw new AppError('Tài khoản OAuth không thể xoá bằng mật khẩu. Vui lòng liên hệ quản trị viên.', 400, 'OAUTH_ACCOUNT');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        name: 'Người dùng đã xoá',
        passwordHash: null,
        avatarUrl: null,
        bio: null,
        githubId: null,
        googleId: null,
        githubUrl: null,
        linkedinUrl: null,
        refreshToken: null,
        emailVerifyToken: null,
        emailVerifyExp: null,
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
