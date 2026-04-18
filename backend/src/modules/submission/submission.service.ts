import fs from 'fs';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { StorageService } from '../../services/storage.service';
import { createRedisConnection } from '../../config/redis';
import { sanitizeFilename, validateCsvMagicBytes, computeFileHash, stripHtmlTags } from '../../utils/fileHelpers';
import { submissionUploadTotal } from '../../config/metrics';
import { scanFile } from '../../services/antivirus.service';

const storage = new StorageService();
export const scoringQueue = new Queue('scoring', {
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
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    if (competition.status !== 'ACTIVE') {
      throw new AppError('Cuộc thi hiện không mở để nộp bài', 400, 'COMPETITION_ENDED');
    }

    if (file.size > competition.maxFileSize) {
      fs.unlink(file.path, () => {});
      submissionUploadTotal.inc({ outcome: 'too_large' });
      throw new AppError(`Tệp vượt quá kích thước cho phép. Tối đa ${Math.round(competition.maxFileSize / 1048576)} MB`, 413, 'FILE_TOO_LARGE');
    }

    if (!validateCsvMagicBytes(file.path)) {
      fs.unlink(file.path, () => {});
      submissionUploadTotal.inc({ outcome: 'invalid_type' });
      throw new AppError('Tệp không phải CSV hợp lệ', 400, 'INVALID_FILE_TYPE');
    }

    const scanResult = await scanFile(file.path);
    if (!scanResult.clean) {
      fs.unlink(file.path, () => {});
      submissionUploadTotal.inc({ outcome: 'virus_detected' });
      throw new AppError(`Tệp chứa mã độc (${scanResult.virus}) và đã bị từ chối`, 400, 'VIRUS_DETECTED');
    }

    const fileHash = await computeFileHash(file.path);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
    });
    if (!enrollment) {
      fs.unlink(file.path, () => {});
      throw new AppError('Bạn phải tham gia cuộc thi trước', 403, 'NOT_ENROLLED');
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
          throw new AppError('Tệp này đã được nộp trước đó', 409, 'DUPLICATE_SUBMISSION');
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const dailyCount = await tx.submission.count({
          where: { userId, competitionId, createdAt: { gte: todayStart, lt: todayEnd } },
        });
        if (dailyCount >= competition.maxDailySubs) {
          throw new AppError(`Bạn đã đạt giới hạn ${competition.maxDailySubs} lượt nộp trong ngày. Vui lòng thử lại vào ngày mai.`, 429, 'DAILY_LIMIT_EXCEEDED');
        }

        if (competition.maxTotalSubs) {
          const totalCount = await tx.submission.count({ where: { userId, competitionId } });
          if (totalCount >= competition.maxTotalSubs) {
            throw new AppError('Bạn đã đạt giới hạn tổng số lượt nộp', 429, 'TOTAL_LIMIT_EXCEEDED');
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
        throw new AppError('Tệp này đã được nộp trước đó', 409, 'DUPLICATE_SUBMISSION');
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

    submissionUploadTotal.inc({ outcome: 'queued' });
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
    if (!submission) throw new AppError('Không tìm thấy bài nộp', 404);
    if (submission.userId !== userId) throw new AppError('Bạn không có quyền thực hiện thao tác này', 403);
    if (submission.status !== 'SCORED') throw new AppError('Bài nộp chưa được chấm điểm', 400);

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
