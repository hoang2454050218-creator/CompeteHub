import { Router } from 'express';
import { EnrollmentController } from './enrollment.controller';
import { authenticate } from '../../middleware/auth';
import { validateUUID } from '../../middleware/validate';

const router = Router({ mergeParams: true });
const controller = new EnrollmentController();

router.post('/:id/enroll', authenticate, validateUUID('id'), controller.enroll);
router.delete('/:id/enroll', authenticate, validateUUID('id'), controller.unenroll);
router.get('/:id/enrollment', authenticate, validateUUID('id'), controller.checkEnrollment);
router.get('/:id/participants', validateUUID('id'), controller.getParticipants);

export default router;
