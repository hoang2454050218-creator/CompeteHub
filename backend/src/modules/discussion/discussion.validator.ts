// AUDIT-FIX: Input validation for discussion endpoints
import { z } from 'zod';

export const createTopicSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
});

export const updateTopicSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, {
  message: 'At least one field (title or content) must be provided',
});

export const createReplySchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  parentReplyId: z.string().uuid().optional(),
});

export const updateReplySchema = z.object({
  content: z.string().min(1).max(10000),
});

export const voteSchema = z.object({
  type: z.enum(['DISCUSSION', 'REPLY']),
  targetId: z.string().uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const pinSchema = z.object({
  isPinned: z.boolean(),
});
