import { Request, Response, NextFunction } from 'express';
import { DatasetService } from './dataset.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';

const service = new DatasetService();

export class DatasetController {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) return next(new AppError('Vui lòng chọn tệp để tải lên', 400));
      const dataset = await service.upload(
        req.params.id,
        req.user!.userId,
        req.file,
        req.body.title || req.file.originalname,
        req.body.description,
        req.body.isPublic === 'true'
      );
      sendSuccess(res, { ...dataset, fileSize: dataset.fileSize.toString() }, 'Tải bộ dữ liệu lên thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await service.list(req.params.id, page, limit);
      sendSuccess(res, result.data.map((d) => ({ ...d, fileSize: d.fileSize.toString() })), 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getDownloadUrl(req.params.datasetId, req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await service.preview(req.params.datasetId, req.user!.userId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
}
