import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { DatasetController } from './dataset.controller';
import { authenticate, authorize, requireEnrolled } from '../../middleware/auth';
import { validateUUID } from '../../middleware/validate';
import { sanitizeFilename, validateDatasetMagicBytes } from '../../utils/fileHelpers';
import { AppError } from '../../utils/apiResponse';
import { Request, Response, NextFunction } from 'express';

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
      cb(new Error('File type not allowed. Accepted: csv, json, zip, gz, parquet, tsv, txt, xlsx'));
    }
  },
});

function validateMagicBytes(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();
  const ext = req.file.originalname.split('.').pop() || '';
  if (!validateDatasetMagicBytes(req.file.path, ext)) {
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});
    return next(new AppError('File content does not match its extension', 400, 'INVALID_FILE_CONTENT'));
  }
  next();
}

router.post('/:id/datasets', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), upload.single('file'), validateMagicBytes, controller.upload);
router.get('/:id/datasets', validateUUID('id'), controller.list);
router.get('/:id/datasets/:datasetId/download', authenticate, requireEnrolled, validateUUID('id', 'datasetId'), controller.download);
router.get('/:id/datasets/:datasetId/preview', authenticate, requireEnrolled, validateUUID('id', 'datasetId'), controller.preview);

export default router;
