import { Request, Response, NextFunction } from 'express';
import { FollowService } from './follow.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new FollowService();

export class FollowController {
  async follow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.follow(req.user!.userId, req.params.id);
      sendSuccess(res, result, result.followed ? 'Đã theo dõi' : 'Bạn đã theo dõi rồi');
    } catch (err) {
      next(err);
    }
  }

  async unfollow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.unfollow(req.user!.userId, req.params.id);
      sendSuccess(res, result, result.unfollowed ? 'Đã bỏ theo dõi' : 'Bạn chưa theo dõi người này');
    } catch (err) {
      next(err);
    }
  }

  async followers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.listFollowers(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async following(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.listFollowing(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const isFollowing = await service.isFollowing(req.user!.userId, req.params.id);
      sendSuccess(res, { isFollowing });
    } catch (err) {
      next(err);
    }
  }
}
