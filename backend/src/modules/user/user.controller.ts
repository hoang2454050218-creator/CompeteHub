import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendSuccess } from '../../utils/apiResponse';

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
}
