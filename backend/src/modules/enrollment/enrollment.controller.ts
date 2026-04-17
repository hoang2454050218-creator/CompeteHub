import { Request, Response, NextFunction } from 'express';
import { EnrollmentService } from './enrollment.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new EnrollmentService();

export class EnrollmentController {
  async enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.enroll(req.user!.userId, req.params.id);
      sendSuccess(res, result, 'Enrolled successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async unenroll(req: Request, res: Response, next: NextFunction) {
    try {
      await service.unenroll(req.user!.userId, req.params.id);
      sendSuccess(res, null, 'Unenrolled');
    } catch (error) {
      next(error);
    }
  }

  async checkEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const enrolled = await service.isEnrolled(req.user!.userId, req.params.id);
      sendSuccess(res, { enrolled });
    } catch (error) {
      next(error);
    }
  }

  async getParticipants(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.getParticipants(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Success', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}
