import { Router } from 'express';
import { CompetitionController } from './competition.controller';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { createCompetitionSchema, updateCompetitionSchema, listCompetitionsSchema, updateStatusSchema } from './competition.validator';

const router = Router();
const controller = new CompetitionController();

router.get('/', optionalAuth, validate(listCompetitionsSchema, 'query'), controller.list);
router.post('/', authenticate, authorize('HOST', 'ADMIN'), validate(createCompetitionSchema), controller.create);
router.get('/:slug', optionalAuth, controller.getBySlug);
router.put('/:id', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), validate(updateCompetitionSchema), controller.update);
router.patch('/:id/status', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), validate(updateStatusSchema), controller.updateStatus);
router.delete('/:id', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), controller.delete);

export default router;
