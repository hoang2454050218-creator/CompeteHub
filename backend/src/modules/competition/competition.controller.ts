import { Request, Response, NextFunction } from 'express';
import { CompetitionService } from './competition.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new CompetitionService();

export class CompetitionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const competition = await service.create(req.user!.userId, req.body);
      sendSuccess(res, competition, 'Competition created', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.list(req.query as unknown as import('./competition.validator').ListCompetitionsQuery);
      sendSuccess(res, result.data, 'Success', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const competition = await service.getBySlug(req.params.slug, req.user?.userId, req.user?.role);
      sendSuccess(res, competition);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const competition = await service.update(req.params.id, req.user!.userId, req.body, isAdmin);
      sendSuccess(res, competition, 'Competition updated');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const competition = await service.updateStatus(req.params.id, req.body.status, req.user!.userId, isAdmin);
      sendSuccess(res, competition, 'Status updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      await service.delete(req.params.id, req.user!.userId, isAdmin);
      sendSuccess(res, null, 'Competition deleted');
    } catch (error) {
      next(error);
    }
  }
}
