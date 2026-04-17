// AUDIT-FIX: Input validation for team endpoints
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Tên đội quá ngắn').max(50),
  competitionId: z.string().uuid(),
});

export const inviteSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const respondSchema = z.object({
  accept: z.boolean(),
});
