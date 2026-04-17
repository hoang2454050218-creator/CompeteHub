import { Response } from 'express';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess(res: Response, data: unknown, message = 'Success', statusCode = 200, pagination?: Pagination) {
  const response: { success: boolean; data: unknown; message: string; pagination?: Pagination } = { success: true, data, message };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, message: string, statusCode = 400, errorCode?: string) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errorCode,
  });
}

export class AppError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode = 400, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
