import { Request, Response, NextFunction } from 'express';
import { SubmissionService } from './submission.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';

const service = new SubmissionService();

export class SubmissionController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) return next(new AppError('File is required', 400, 'MISSING_FILE'));
      const submission = await service.submit(
        req.user!.userId,
        req.params.id,
        req.file,
        req.body.description
      );
      sendSuccess(res, submission, 'Submission received. Scoring in progress.', 202);
    } catch (error) {
      next(error);
    }
  }

  async listMy(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.listUserSubmissions(req.user!.userId, req.params.id, page, limit);
      sendSuccess(res, result.data, 'Success', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async select(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await service.selectSubmission(req.user!.userId, req.params.submissionId);
      sendSuccess(res, submission, 'Submission selected');
    } catch (error) {
      next(error);
    }
  }
}
