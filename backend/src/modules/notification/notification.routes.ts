import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth';
import { validateUUID } from '../../middleware/validate';

const router = Router();
const controller = new NotificationController();

router.get('/', authenticate, controller.list);
router.patch('/:id/read', authenticate, validateUUID('id'), controller.markRead);
router.patch('/read-all', authenticate, controller.markAllRead);

export default router;
