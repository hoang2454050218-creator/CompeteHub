import { Router } from 'express';
import { DiscussionController } from './discussion.controller';
import { authenticate, authorize, requireEnrolled } from '../../middleware/auth';
import { validate, validateUUID } from '../../middleware/validate';
import { createTopicSchema, updateTopicSchema, createReplySchema, updateReplySchema, voteSchema, pinSchema } from './discussion.validator';

const router = Router({ mergeParams: true });
const controller = new DiscussionController();

router.get('/:id/discussions', validateUUID('id'), controller.listTopics);
router.post('/:id/discussions', authenticate, requireEnrolled, validateUUID('id'), validate(createTopicSchema), controller.createTopic);
router.get('/:id/discussions/:discussionId', validateUUID('id', 'discussionId'), controller.getTopic);
router.put('/:id/discussions/:discussionId', authenticate, validateUUID('id', 'discussionId'), validate(updateTopicSchema), controller.updateTopic);
router.delete('/:id/discussions/:discussionId', authenticate, validateUUID('id', 'discussionId'), controller.deleteTopic);
router.post('/:id/discussions/:discussionId/replies', authenticate, requireEnrolled, validateUUID('id', 'discussionId'), validate(createReplySchema), controller.createReply);
router.put('/:id/discussions/:discussionId/replies/:replyId', authenticate, validateUUID('id', 'discussionId', 'replyId'), validate(updateReplySchema), controller.updateReply);
router.delete('/:id/discussions/:discussionId/replies/:replyId', authenticate, validateUUID('id', 'discussionId', 'replyId'), controller.deleteReply);
router.post('/:id/discussions/:discussionId/vote', authenticate, requireEnrolled, validateUUID('id', 'discussionId'), validate(voteSchema), controller.vote);
router.patch('/:id/discussions/:discussionId/pin', authenticate, authorize('HOST', 'ADMIN'), validateUUID('id', 'discussionId'), validate(pinSchema), controller.pin);

export default router;
