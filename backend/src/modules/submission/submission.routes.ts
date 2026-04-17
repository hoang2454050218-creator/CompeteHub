import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { SubmissionController } from './submission.controller';
import { authenticate, requireEnrolled } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { sanitizeFilename } from '../../utils/fileHelpers';
import { submitSubmissionSchema } from './submission.validator';

const router = Router({ mergeParams: true });
const controller = new SubmissionController();

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, sanitizeFilename(file.originalname)),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp CSV'));
    }
  },
});

router.post('/:id/submissions', authenticate, requireEnrolled, validateUUID('id'), upload.single('file'), validate(submitSubmissionSchema), controller.submit);
router.get('/:id/submissions', authenticate, requireEnrolled, validateUUID('id'), controller.listMy);
router.patch('/:id/submissions/:submissionId/select', authenticate, validateUUID('id', 'submissionId'), controller.select);

export default router;
