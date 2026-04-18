import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateProfileSchema, notificationPreferencesSchema, deleteAccountSchema } from './user.validator';

const router = Router();
const controller = new UserController();

router.get('/me/export', authenticate, controller.exportData);
router.delete('/me', authenticate, validate(deleteAccountSchema), controller.deleteAccount);
router.put('/me', authenticate, validate(updateProfileSchema), controller.updateProfile);
router.put('/me/notification-preferences', authenticate, validate(notificationPreferencesSchema), controller.updateNotificationPreferences);
router.get('/:id', optionalAuth, controller.getProfile);

export default router;
