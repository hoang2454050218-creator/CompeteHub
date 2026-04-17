import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../config/database';
import { AppError } from '../utils/apiResponse';
import { Role } from '@prisma/client';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, email: true, name: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('Account is deactivated or not found', 401, 'UNAUTHORIZED');
    }

    req.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, email: true, name: true, isActive: true },
      });
      if (user && user.isActive) {
        req.user = {
          userId: user.id,
          role: user.role,
          email: user.email,
          name: user.name,
        };
      }
    }
  } catch {
    // optional - continue without user
  }
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}

export async function requireEnrolled(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const competitionId = req.params.id || req.params.competitionId;
    if (!competitionId) {
      throw new AppError('Competition ID required', 400);
    }

    if (req.user.role === 'ADMIN') return next();

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_competitionId: {
          userId: req.user.userId,
          competitionId,
        },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled in this competition', 403, 'NOT_ENROLLED');
    }

    next();
  } catch (error) {
    next(error);
  }
}
