import { Request, Response, NextFunction } from 'express';
import { CompetitionService } from './competition.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new CompetitionService();

export class CompetitionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const competition = await service.create(req.user!.userId, req.body);
      sendSuccess(res, competition, 'Tạo cuộc thi thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.list(req.query as unknown as import('./competition.validator').ListCompetitionsQuery);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
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
      sendSuccess(res, competition, 'Cập nhật cuộc thi thành công');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const competition = await service.updateStatus(req.params.id, req.body.status, req.user!.userId, isAdmin);
      sendSuccess(res, competition, 'Cập nhật trạng thái thành công');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      await service.delete(req.params.id, req.user!.userId, isAdmin);
      sendSuccess(res, null, 'Xóa cuộc thi thành công');
    } catch (error) {
      next(error);
    }
  }
}
