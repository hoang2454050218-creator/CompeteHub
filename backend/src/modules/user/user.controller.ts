import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendSuccess } from '../../utils/apiResponse';
import { auditLog, actorFromRequest } from '../../services/auditLog.service';

const service = new UserService();

export class UserController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const isOwnProfile = req.user?.userId === req.params.id;
      const profile = await service.getProfile(req.params.id, isOwnProfile);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await service.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, user, 'Cập nhật hồ sơ thành công');
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      await service.updateNotificationPreferences(req.user!.userId, req.body.preferences);
      sendSuccess(res, null, 'Cập nhật tuỳ chọn thông báo thành công');
    } catch (error) {
      next(error);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await service.exportUserData(req.user!.userId);
      void auditLog.record({
        ...actorFromRequest(req),
        action: 'gdpr.export',
        resource: 'user',
        resourceId: req.user!.userId,
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="competehub-export-${req.user!.userId}.json"`);
      res.send(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      await service.deleteAccount(req.user!.userId, req.body.password);
      void auditLog.record({
        ...actorFromRequest(req),
        action: 'gdpr.delete',
        resource: 'user',
        resourceId: req.user!.userId,
      });
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
      sendSuccess(res, null, 'Tài khoản đã được xoá. Tạm biệt.');
    } catch (error) {
      next(error);
    }
  }
}
