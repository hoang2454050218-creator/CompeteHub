import { Router } from 'express';
import { LeaderboardController } from './leaderboard.controller';
import { authenticate, authorize, requireEnrolled } from '../../middleware/auth';
import { validateUUID } from '../../middleware/validate';

const router = Router({ mergeParams: true });
const controller = new LeaderboardController();

router.get('/:id/leaderboard', validateUUID('id'), controller.getPublic);
router.get('/:id/leaderboard/private', authenticate, requireEnrolled, validateUUID('id'), controller.getPrivate);
router.get('/:id/leaderboard/shakeup', authenticate, requireEnrolled, validateUUID('id'), controller.getShakeup);
router.get('/:id/leaderboard/export', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id'), controller.exportCsv);

export default router;
