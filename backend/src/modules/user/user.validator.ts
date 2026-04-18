import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
});

export const notificationPreferencesSchema = z.object({
  preferences: z.record(z.string().min(1).max(50), z.boolean()),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Vui lòng nhập "DELETE" để xác nhận' }) }),
});
