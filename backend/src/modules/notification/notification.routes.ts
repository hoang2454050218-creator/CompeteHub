import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { listNotificationsQuerySchema } from './notification.validator';

const router = Router();
const controller = new NotificationController();

router.get('/', authenticate, validate(listNotificationsQuerySchema, 'query'), controller.list);
router.patch('/:id/read', authenticate, validateUUID('id'), controller.markRead);
router.patch('/read-all', authenticate, controller.markAllRead);

export default router;
