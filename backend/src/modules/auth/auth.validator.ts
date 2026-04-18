import { z } from 'zod';

// AUDIT-FIX: Password complexity enforcement
const passwordSchema = z.string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu quá dài')
  .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ in hoa')
  .regex(/[a-z]/, 'Phải có ít nhất 1 chữ thường')
  .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số');

export const registerSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
  password: passwordSchema,
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const exchangeCodeSchema = z.object({
  code: z.string().min(1, 'Vui lòng cung cấp mã xác thực').max(256),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Thiếu mã xác minh').max(256),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
});

export const mfaLoginSchema = z.object({
  mfaToken: z.string().min(1).max(256),
  code: z.string().min(6).max(16),
});

export const mfaEnableSchema = z.object({
  code: z.string().min(6).max(16),
});

export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
