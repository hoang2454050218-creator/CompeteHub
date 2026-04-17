import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new NotificationService();

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unread === 'true';
      const result = await service.getUserNotifications(req.user!.userId, page, limit, unreadOnly);
      sendSuccess(res, { notifications: result.data, unreadCount: result.unreadCount }, 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await service.markAsRead(req.user!.userId, req.params.id);
      sendSuccess(res, null, 'Đã đánh dấu là đã đọc');
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await service.markAllAsRead(req.user!.userId);
      sendSuccess(res, null, 'Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (error) {
      next(error);
    }
  }
}
