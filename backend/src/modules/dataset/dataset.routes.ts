import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { DatasetController } from './dataset.controller';
import { authenticate, authorize, requireEnrolled } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { sanitizeFilename, validateDatasetMagicBytes } from '../../utils/fileHelpers';
import { scanFile } from '../../services/antivirus.service';
import { AppError } from '../../utils/apiResponse';
import { Request, Response, NextFunction } from 'express';
import { uploadDatasetSchema } from './dataset.validator';

const router = Router({ mergeParams: true });
const controller = new DatasetController();
const ALLOWED_DATASET_TYPES = new Set([
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/vnd.apache.parquet',
  'application/octet-stream',
]);

const ALLOWED_DATASET_EXTENSIONS = /\.(csv|json|zip|gz|parquet|tsv|txt|xlsx)$/i;

// AUDIT-FIX: Use disk storage to prevent OOM on large dataset uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, sanitizeFilename(file.originalname)),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DATASET_TYPES.has(file.mimetype) || ALLOWED_DATASET_EXTENSIONS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng tệp không được hỗ trợ. Chấp nhận: csv, json, zip, gz, parquet, tsv, txt, xlsx'));
    }
  },
});

function validateMagicBytes(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();
  const ext = req.file.originalname.split('.').pop() || '';
  if (!validateDatasetMagicBytes(req.file.path, ext)) {
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});
    return next(new AppError('Nội dung tệp không khớp với phần mở rộng', 400, 'INVALID_FILE_CONTENT'));
  }
  next();
}

async function antivirusScan(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();
  try {
    const result = await scanFile(req.file.path);
    if (!result.clean) {
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
      return next(new AppError(`Tệp chứa mã độc (${result.virus}) và đã bị từ chối`, 400, 'VIRUS_DETECTED'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.post('/:id/datasets', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), upload.single('file'), validateMagicBytes, antivirusScan, validate(uploadDatasetSchema), controller.upload);
router.get('/:id/datasets', validateUUID('id'), controller.list);
router.get('/:id/datasets/:datasetId/download', authenticate, requireEnrolled, validateUUID('id', 'datasetId'), controller.download);
router.get('/:id/datasets/:datasetId/preview', authenticate, requireEnrolled, validateUUID('id', 'datasetId'), controller.preview);

export default router;
