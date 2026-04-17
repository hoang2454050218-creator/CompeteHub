import { z } from 'zod';

export const updateUserSchema = z.object({
  role: z.enum(['PARTICIPANT', 'HOST', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => data.role !== undefined || data.isActive !== undefined, {
  message: 'At least one field (role or isActive) must be provided',
});

export const reviewCompetitionSchema = z.object({
  action: z.enum(['approve', 'reject']),
});
