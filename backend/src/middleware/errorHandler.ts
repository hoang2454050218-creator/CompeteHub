import { Request, Response, NextFunction } from 'express';
import { AppError, sendError } from '../utils/apiResponse';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { Sentry } from '../config/sentry';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.errorCode);
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return sendError(res, message, 400, 'VALIDATION_ERROR');
  }

  // AUDIT-FIX: Handle Prisma-specific errors with proper status codes
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return sendError(res, 'A record with this value already exists', 409, 'DUPLICATE_ENTRY');
      case 'P2025':
        return sendError(res, 'Record not found', 404, 'NOT_FOUND');
      case 'P2003':
        return sendError(res, 'Referenced record does not exist', 400, 'FK_VIOLATION');
      case 'P2034':
        return sendError(res, 'Transaction conflict, please retry', 409, 'TRANSACTION_CONFLICT');
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid data provided', 400, 'VALIDATION_ERROR');
  }

  // AUDIT-FIX M-07: don't log raw body for SyntaxError (body parser failure)
  // — raw string body bypasses pino's *.password redact and leaks credentials
  const safeErr = err instanceof SyntaxError && 'body' in err
    ? { type: err.constructor.name, message: err.message }
    : err;
  logger.error({ err: safeErr, method: req.method, url: req.originalUrl }, 'Unhandled error');
  Sentry.captureException(err, { extra: { method: req.method, url: req.originalUrl } });
  return sendError(res, 'Internal server error', 500, 'INTERNAL_ERROR');
}
