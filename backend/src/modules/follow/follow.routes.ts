import { Router } from 'express';
import { FollowController } from './follow.controller';
import { authenticate } from '../../middleware/auth';
import { validateUUID } from '../../middleware/validate';

const router = Router();
const controller = new FollowController();

router.post('/:id/follow', authenticate, validateUUID('id'), controller.follow);
router.delete('/:id/follow', authenticate, validateUUID('id'), controller.unfollow);
router.get('/:id/followers', validateUUID('id'), controller.followers);
router.get('/:id/following', validateUUID('id'), controller.following);
router.get('/:id/follow-status', authenticate, validateUUID('id'), controller.status);

export default router;
