import fs from 'fs';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { StorageService } from '../../services/storage.service';
import { createRedisConnection } from '../../config/redis';
import { sanitizeFilename, validateCsvMagicBytes, computeFileHash, stripHtmlTags } from '../../utils/fileHelpers';

const storage = new StorageService();
const scoringQueue = new Queue('scoring', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});

export class SubmissionService {
  async submit(userId: string, competitionId: string, file: Express.Multer.File, rawDescription?: string) {
    const description = rawDescription ? stripHtmlTags(rawDescription) : undefined;
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (competition.status !== 'ACTIVE') {
      throw new AppError('Competition is not active', 400, 'COMPETITION_ENDED');
    }

    if (file.size > competition.maxFileSize) {
      fs.unlink(file.path, () => {});
      throw new AppError(`File too large. Max: ${Math.round(competition.maxFileSize / 1048576)}MB`, 413, 'FILE_TOO_LARGE');
    }

    if (!validateCsvMagicBytes(file.path)) {
      fs.unlink(file.path, () => {});
      throw new AppError('File does not appear to be a valid CSV', 400, 'INVALID_FILE_TYPE');
    }

    const fileHash = await computeFileHash(file.path);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
    });
    if (!enrollment) {
      fs.unlink(file.path, () => {});
      throw new AppError('You must be enrolled', 403, 'NOT_ENROLLED');
    }

    const safeName = sanitizeFilename(file.originalname);
    const objectName = `submissions/${competitionId}/${userId}/${Date.now()}_${safeName}`;

    try {
      const stream = fs.createReadStream(file.path);
      await storage.uploadStream(objectName, stream, file.size, 'text/csv');
    } catch (err) {
      fs.unlink(file.path, () => {});
      throw err;
    } finally {
      fs.unlink(file.path, () => {});
    }

    let submission;
    try {
      submission = await prisma.$transaction(async (tx) => {
        const duplicateSubmission = await tx.submission.findFirst({
          where: {
            userId,
            competitionId,
            fileHash,
            status: { in: ['QUEUED', 'SCORING', 'SCORED'] },
          },
        });
        if (duplicateSubmission) {
          throw new AppError('This file has already been submitted', 409, 'DUPLICATE_SUBMISSION');
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const dailyCount = await tx.submission.count({
          where: { userId, competitionId, createdAt: { gte: todayStart, lt: todayEnd } },
        });
        if (dailyCount >= competition.maxDailySubs) {
          throw new AppError(`Daily limit reached (${competition.maxDailySubs}). Try again tomorrow.`, 429, 'DAILY_LIMIT_EXCEEDED');
        }

        if (competition.maxTotalSubs) {
          const totalCount = await tx.submission.count({ where: { userId, competitionId } });
          if (totalCount >= competition.maxTotalSubs) {
            throw new AppError('Total submission limit reached', 429, 'TOTAL_LIMIT_EXCEEDED');
          }
        }

        return tx.submission.create({
          data: {
            userId,
            competitionId,
            teamId: enrollment.teamId,
            fileUrl: objectName,
            fileName: safeName,
            fileHash,
            description: description || null,
            status: 'QUEUED',
          },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      await storage.delete(objectName).catch(() => {});
      // AUDIT-FIX H-01: DB-level UNIQUE constraint catches race-condition duplicates
      // that slip past the in-transaction findFirst check
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('This file has already been submitted', 409, 'DUPLICATE_SUBMISSION');
      }
      throw err;
    }

    await scoringQueue.add('score-submission', {
      submissionId: submission.id,
      competitionId,
      userId,
      teamId: enrollment.teamId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return submission;
  }

  async listUserSubmissions(userId: string, competitionId: string, page = 1, limit = 20) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.submission.findMany({
        where: { userId, competitionId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        select: {
          id: true,
          fileName: true,
          description: true,
          status: true,
          publicScore: true,
          isSelected: true,
          scoredAt: true,
          createdAt: true,
        },
      }),
      prisma.submission.count({ where: { userId, competitionId } }),
    ]);

    return {
      data,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async selectSubmission(userId: string, submissionId: string) {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new AppError('Submission not found', 404);
    if (submission.userId !== userId) throw new AppError('Not authorized', 403);
    if (submission.status !== 'SCORED') throw new AppError('Submission not scored yet', 400);

    return prisma.$transaction(async (tx) => {
      await tx.submission.updateMany({
        where: { userId: submission.userId, competitionId: submission.competitionId },
        data: { isSelected: false },
      });
      return tx.submission.update({
        where: { id: submissionId },
        data: { isSelected: true },
      });
    }, { isolationLevel: 'Serializable' });
  }
}
