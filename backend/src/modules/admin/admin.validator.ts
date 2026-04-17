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

// AUDIT-FIX M-04: Validate query params for the admin users list endpoint.
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  role: z.enum(['PARTICIPANT', 'HOST', 'ADMIN']).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
