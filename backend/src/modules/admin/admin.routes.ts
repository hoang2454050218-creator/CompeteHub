import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateUserSchema, reviewCompetitionSchema } from './admin.validator';

const router = Router();
const controller = new AdminController();

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', controller.dashboard);
router.patch('/competitions/:id/review', validate(reviewCompetitionSchema), controller.reviewCompetition);
router.get('/users', controller.listUsers);
router.patch('/users/:id', validate(updateUserSchema), controller.updateUser);

export default router;
