import prisma from '../../config/database';
import { NotificationType, Prisma } from '@prisma/client';

export class NotificationService {
  async create(userId: string, type: NotificationType, title: string, message: string, refType?: string, refId?: string) {
    return prisma.notification.create({
      data: { userId, type, title, message, refType, refId },
    });
  }

  async createBulk(userIds: string[], type: NotificationType, title: string, message: string, refType?: string, refId?: string) {
    return prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, message, refType, refId })),
    });
  }

  async getUserNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    limit = Math.min(Math.max(1, limit), 100);
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async cleanupOld(daysToKeep = 90) {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    return prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff }, isRead: true },
    });
  }
}
