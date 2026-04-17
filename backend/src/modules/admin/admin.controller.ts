import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { Role } from '@prisma/client';

const service = new AdminService();

export class AdminController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await service.getDashboard();
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async reviewCompetition(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.reviewCompetition(req.params.id, req.body.action);
      sendSuccess(res, result, `Competition ${req.body.action}d`);
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const role = req.query.role as Role | undefined;
      const result = await service.listUsers(page, limit, search, role);
      sendSuccess(res, result.data, 'Success', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await service.updateUser(req.params.id, req.body);
      sendSuccess(res, user, 'User updated');
    } catch (error) {
      next(error);
    }
  }
}
