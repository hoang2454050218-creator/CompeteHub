import type { Request } from 'express';
import type { Role } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export interface AuditLogInput {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export class AuditLogService {
  async record(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          metadata: (input.metadata as object | undefined) ?? undefined,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      logger.error({ err, input }, 'Failed to write audit log');
    }
  }

  async list(opts: { actorId?: string; resource?: string; action?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
    const where = {
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
      ...(opts.resource ? { resource: opts.resource } : {}),
      ...(opts.action ? { action: opts.action } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const auditLog = new AuditLogService();

export function actorFromRequest(req: Request): Pick<AuditLogInput, 'actorId' | 'actorRole' | 'ip' | 'userAgent'> {
  return {
    actorId: req.user?.userId ?? null,
    actorRole: (req.user?.role as Role | undefined) ?? null,
    ip:
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip) || null,
    userAgent: req.get('user-agent') || null,
  };
}
