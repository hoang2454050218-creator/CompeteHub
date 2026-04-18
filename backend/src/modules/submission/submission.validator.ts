import { z } from 'zod';

// AUDIT-FIX M-03: Validate multipart body fields after multer parses them.
export const submitSubmissionSchema = z.object({
  description: z.string().max(2000).optional(),
  submissionType: z.enum(['CSV', 'NOTEBOOK', 'SCRIPT']).optional(),
  kernelUrl: z.string().url().max(2048).optional().or(z.literal('')),
});

export type SubmitSubmissionInput = z.infer<typeof submitSubmissionSchema>;
