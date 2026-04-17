import slug from 'slug';
import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { stripHtmlTags } from '../../utils/fileHelpers';
import { CreateCompetitionInput, UpdateCompetitionInput, ListCompetitionsQuery } from './competition.validator';
import { CompetitionStatus, Prisma } from '@prisma/client';

function sanitizeCompetitionInput<T extends Record<string, unknown>>(input: T): T {
  const sanitized = { ...input } as Record<string, unknown>;
  for (const field of ['title', 'description', 'rules', 'prize'] as const) {
    const val = sanitized[field];
    if (typeof val === 'string') sanitized[field] = stripHtmlTags(val);
  }
  if (Array.isArray(sanitized.tags)) {
    sanitized.tags = (sanitized.tags as unknown[]).map((t) =>
      typeof t === 'string' ? stripHtmlTags(t) : t
    );
  }
  return sanitized as T;
}

async function ensureUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const baseSlug = slug(title);
  let finalSlug = baseSlug;
  let counter = 0;
  const MAX_SLUG_ATTEMPTS = 100;

  while (await prisma.competition.findFirst({ where: { slug: finalSlug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) {
    counter++;
    if (counter > MAX_SLUG_ATTEMPTS) {
      finalSlug = `${baseSlug}-${Date.now()}`;
      break;
    }
    finalSlug = `${baseSlug}-${counter}`;
  }

  return finalSlug;
}

export class CompetitionService {
  async create(hostId: string, rawInput: CreateCompetitionInput) {
    const input = sanitizeCompetitionInput(rawInput);
    const finalSlug = await ensureUniqueSlug(input.title);

    return prisma.competition.create({
      data: {
        hostId,
        title: input.title,
        slug: finalSlug,
        description: input.description,
        rules: input.rules,
        coverImage: input.coverImage,
        category: input.category,
        tags: input.tags,
        prize: input.prize,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        evalMetric: input.evalMetric,
        pubPrivSplit: input.pubPrivSplit,
        maxTeamSize: input.maxTeamSize,
        maxDailySubs: input.maxDailySubs,
        maxTotalSubs: input.maxTotalSubs,
        maxFileSize: input.maxFileSize,
        mergeDeadline: input.mergeDeadline ? new Date(input.mergeDeadline) : undefined,
      },
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async list(query: ListCompetitionsQuery) {
    const where: Prisma.CompetitionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] };
    }
    if (query.category) where.category = query.category;
    if (query.tag) where.tags = { has: query.tag };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.CompetitionOrderByWithRelationInput = (() => {
      switch (query.sort) {
        case 'oldest': return { createdAt: 'asc' as const };
        case 'deadline': return { endDate: 'asc' as const };
        default: return { createdAt: 'desc' as const };
      }
    })();

    const [data, total] = await Promise.all([
      prisma.competition.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { enrollments: true, submissions: true } },
        },
      }),
      prisma.competition.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getBySlug(slugVal: string, requestUserId?: string, requestUserRole?: string) {
    const competition = await prisma.competition.findUnique({
      where: { slug: slugVal },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { enrollments: true, submissions: true, discussions: true } },
      },
    });

    if (!competition) throw new AppError('Competition not found', 404);

    const isDraftOrPending = competition.status === 'DRAFT' || competition.status === 'PENDING_REVIEW';
    const isOwnerOrAdmin = requestUserId && (competition.hostId === requestUserId || requestUserRole === 'ADMIN');
    if (isDraftOrPending && !isOwnerOrAdmin) {
      throw new AppError('Competition not found', 404);
    }

    return competition;
  }

  async getById(id: string) {
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { enrollments: true, submissions: true, discussions: true } },
      },
    });

    if (!competition) throw new AppError('Competition not found', 404);
    return competition;
  }

  async update(id: string, hostId: string, rawInput: UpdateCompetitionInput, isAdmin = false) {
    const input = sanitizeCompetitionInput(rawInput);
    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (!isAdmin && competition.hostId !== hostId) {
      throw new AppError('Not authorized to update this competition', 403);
    }

    // AUDIT-FIX: Prevent changing critical fields while competition is active
    const IMMUTABLE_WHEN_ACTIVE = ['evalMetric', 'pubPrivSplit', 'maxTeamSize', 'startDate', 'endDate'] as const;
    if (competition.status === 'ACTIVE' || competition.status === 'COMPLETED') {
      for (const field of IMMUTABLE_WHEN_ACTIVE) {
        const newVal = input[field as keyof typeof input];
        if (newVal !== undefined && newVal !== (competition as Record<string, unknown>)[field]) {
          throw new AppError(`Cannot change "${field}" after competition is active`, 400, 'IMMUTABLE_FIELD');
        }
      }
    }

    const data: Record<string, unknown> = { ...input };
    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate) data.endDate = new Date(input.endDate);
    if (input.mergeDeadline) data.mergeDeadline = new Date(input.mergeDeadline);

    if (input.title && input.title !== competition.title) {
      data.slug = await ensureUniqueSlug(input.title, id);
    }

    return prisma.competition.update({
      where: { id },
      data,
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async updateStatus(id: string, status: CompetitionStatus, userId: string, isAdmin = false) {
    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) throw new AppError('Competition not found', 404);

    const validTransitions: Record<CompetitionStatus, CompetitionStatus[]> = {
      DRAFT: ['PENDING_REVIEW'],
      PENDING_REVIEW: ['ACTIVE', 'DRAFT'],
      ACTIVE: ['COMPLETED'],
      COMPLETED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    if (!validTransitions[competition.status]?.includes(status)) {
      throw new AppError(`Cannot transition from ${competition.status} to ${status}`, 400);
    }

    if (!isAdmin && competition.hostId !== userId) {
      throw new AppError('Not authorized to change this competition status', 403);
    }

    if (['ACTIVE', 'DRAFT'].includes(status) && competition.status === 'PENDING_REVIEW' && !isAdmin) {
      throw new AppError('Only admin can approve/reject competitions', 403);
    }

    return prisma.competition.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, hostId: string, isAdmin = false) {
    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (!isAdmin && competition.hostId !== hostId) {
      throw new AppError('Not authorized', 403);
    }
    if (competition.status === 'ACTIVE') {
      throw new AppError('Cannot delete an active competition', 400);
    }

    await prisma.competition.delete({ where: { id } });
  }
}
