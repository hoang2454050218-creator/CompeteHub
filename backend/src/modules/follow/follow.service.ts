import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

export class FollowService {
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new AppError('Bạn không thể theo dõi chính mình', 400, 'SELF_FOLLOW');
    }
    const target = await prisma.user.findUnique({ where: { id: followingId, deletedAt: null } });
    if (!target) throw new AppError('Không tìm thấy người dùng', 404);

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      });
      if (existing) return false;

      await tx.follow.create({ data: { followerId, followingId } });
      await tx.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: followingId },
        data: { followerCount: { increment: 1 } },
      });
      return true;
    }, { isolationLevel: 'Serializable' });

    if (created) {
      try {
        const follower = await prisma.user.findUnique({
          where: { id: followerId },
          select: { name: true },
        });
        await notificationService.create(
          followingId,
          'NEW_FOLLOWER',
          'Bạn có người theo dõi mới',
          `${follower?.name ?? 'Một người dùng'} đã theo dõi bạn`,
          'user',
          followerId
        );
      } catch {
        // Non-fatal
      }
    }

    return { followed: created };
  }

  async unfollow(followerId: string, followingId: string) {
    const removed = await prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      });
      if (!existing) return false;

      await tx.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      await tx.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      });
      await tx.user.update({
        where: { id: followingId },
        data: { followerCount: { decrement: 1 } },
      });
      return true;
    }, { isolationLevel: 'Serializable' });

    return { unfollowed: removed };
  }

  async listFollowers(userId: string, page = 1, limit = 20) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        include: {
          follower: { select: { id: true, name: true, avatarUrl: true, role: true } },
        },
      }),
      prisma.follow.count({ where: { followingId: userId } }),
    ]);
    return {
      data: data.map((f) => f.follower),
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async listFollowing(userId: string, page = 1, limit = 20) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        include: {
          following: { select: { id: true, name: true, avatarUrl: true, role: true } },
        },
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return {
      data: data.map((f) => f.following),
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async isFollowing(followerId: string, followingId: string) {
    const found = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!found;
  }
}
