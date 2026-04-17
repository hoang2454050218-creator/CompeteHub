import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from '../utils/apiResponse';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const allowedOrigin = config.frontendUrl;

  if (origin) {
    if (origin === allowedOrigin) return next();
    return next(new AppError('CSRF validation failed', 403, 'CSRF_ERROR'));
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin === allowedOrigin) return next();
    } catch {
      // invalid referer URL
    }
    return next(new AppError('CSRF validation failed', 403, 'CSRF_ERROR'));
  }

  return next(new AppError('CSRF validation failed: missing origin', 403, 'CSRF_ERROR'));
}
