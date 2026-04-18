import { Router } from 'express';
import { BadgeController } from './badge.controller';
import { validateUUID } from '../../middleware/validate';

const router = Router();
const controller = new BadgeController();

router.get('/', controller.listAll);
router.get('/users/:id', validateUUID('id'), controller.listForUser);

export default router;
