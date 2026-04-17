import { Router } from 'express';
import { TeamController } from './team.controller';
import { authenticate } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { createTeamSchema, inviteSchema, respondSchema } from './team.validator';

const router = Router();
const controller = new TeamController();

router.post('/', authenticate, validate(createTeamSchema), controller.create);
router.get('/invitations', authenticate, controller.getMyInvitations);
router.get('/:id', authenticate, validateUUID('id'), controller.getTeam);
router.post('/:id/invite', authenticate, validateUUID('id'), validate(inviteSchema), controller.invite);
router.patch('/invitations/:invitationId', authenticate, validateUUID('invitationId'), validate(respondSchema), controller.respond);

export default router;
