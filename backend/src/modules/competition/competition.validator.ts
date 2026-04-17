import { z } from 'zod';

export const createCompetitionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  rules: z.string().optional(),
  coverImage: z.string().url().optional(),
  category: z.enum(['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY']).default('COMMUNITY'),
  tags: z.array(z.string()).default([]),
  prize: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  evalMetric: z.enum(['ACCURACY', 'RMSE', 'F1_SCORE', 'AUC_ROC', 'LOG_LOSS', 'CUSTOM']).default('ACCURACY'),
  pubPrivSplit: z.number().gt(0, 'Phải lớn hơn 0').lt(1, 'Phải nhỏ hơn 1').default(0.3),
  maxTeamSize: z.number().int().min(1).default(1),
  maxDailySubs: z.number().int().min(1).default(5),
  maxTotalSubs: z.number().int().optional(),
  maxFileSize: z.number().int().default(104857600),
  mergeDeadline: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['endDate'] }
);

export const updateCompetitionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional(),
  rules: z.string().optional(),
  coverImage: z.string().url().optional(),
  category: z.enum(['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY']).optional(),
  tags: z.array(z.string()).optional(),
  prize: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  evalMetric: z.enum(['ACCURACY', 'RMSE', 'F1_SCORE', 'AUC_ROC', 'LOG_LOSS', 'CUSTOM']).optional(),
  pubPrivSplit: z.number().gt(0).lt(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  maxDailySubs: z.number().int().min(1).optional(),
  maxTotalSubs: z.number().int().optional(),
  maxFileSize: z.number().int().optional(),
  mergeDeadline: z.string().datetime().optional(),
});

export const listCompetitionsSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  category: z.enum(['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY']).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'participants', 'deadline']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'COMPLETED', 'ARCHIVED']),
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;
export type ListCompetitionsQuery = z.infer<typeof listCompetitionsSchema>;
