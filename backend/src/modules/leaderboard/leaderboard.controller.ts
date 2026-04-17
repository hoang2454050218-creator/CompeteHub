import { Request, Response, NextFunction } from 'express';
import { LeaderboardService } from './leaderboard.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new LeaderboardService();

export class LeaderboardController {
  async getPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await service.getPublicLeaderboard(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async getPrivate(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await service.getPrivateLeaderboard(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async getShakeup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await service.getShakeup(req.params.id);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const csv = await service.exportCsv(req.params.id, req.user!.userId, isAdmin);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leaderboard.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}
