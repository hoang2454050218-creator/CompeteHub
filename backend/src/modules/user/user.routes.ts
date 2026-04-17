import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateProfileSchema } from './user.validator';

const router = Router();
const controller = new UserController();

router.get('/:id', optionalAuth, controller.getProfile);
router.put('/me', authenticate, validate(updateProfileSchema), controller.updateProfile);

export default router;
