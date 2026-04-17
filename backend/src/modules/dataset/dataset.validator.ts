import { z } from 'zod';

// AUDIT-FIX M-03: Validate multipart body fields after multer parses them.
// `isPublic` arrives as a string from form-data (`'true'`/`'false'`); we accept
// the string form here and let the controller coerce.
export const uploadDatasetSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề là bắt buộc').max(200).optional(),
  description: z.string().max(2000).optional(),
  isPublic: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
});

export type UploadDatasetInput = z.infer<typeof uploadDatasetSchema>;
