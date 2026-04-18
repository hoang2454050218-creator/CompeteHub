import { Request, Response, NextFunction } from 'express';
import { BadgeService } from './badge.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new BadgeService();

export class BadgeController {
  async listAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const badges = await service.listAll();
      sendSuccess(res, badges);
    } catch (err) {
      next(err);
    }
  }

  async listForUser(req: Request, res: Response, next: NextFunction) {
    try {
      const badges = await service.listForUser(req.params.id);
      sendSuccess(res, badges);
    } catch (err) {
      next(err);
    }
  }
}
