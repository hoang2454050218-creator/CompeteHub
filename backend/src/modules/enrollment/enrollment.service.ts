import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { Prisma } from '@prisma/client';

export class EnrollmentService {
  async enroll(userId: string, competitionId: string) {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (competition.status !== 'ACTIVE') {
      throw new AppError('Competition is not active', 400);
    }

    try {
      return await prisma.enrollment.create({
        data: { userId, competitionId },
        include: {
          competition: { select: { id: true, title: true, slug: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('Already enrolled', 409);
      }
      throw err;
    }
  }

  async unenroll(userId: string, competitionId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
      include: { team: true },
    });
    if (!enrollment) throw new AppError('Not enrolled', 404);

    await prisma.$transaction(async (tx) => {
      if (enrollment.teamId && enrollment.team) {
        const memberCount = await tx.enrollment.count({ where: { teamId: enrollment.teamId } });
        if (memberCount <= 1) {
          await tx.team.delete({ where: { id: enrollment.teamId } });
        } else if (enrollment.team.leaderId === userId) {
          const nextLeader = await tx.enrollment.findFirst({
            where: { teamId: enrollment.teamId, userId: { not: userId } },
          });
          if (nextLeader) {
            await tx.team.update({
              where: { id: enrollment.teamId },
              data: { leaderId: nextLeader.userId },
            });
          }
        }
      }
      await tx.enrollment.delete({
        where: { userId_competitionId: { userId, competitionId } },
      });
    });
  }

  async isEnrolled(userId: string, competitionId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
    });
    return !!enrollment;
  }

  async getParticipants(competitionId: string, page = 1, limit = 20) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.enrollment.findMany({
        where: { competitionId },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.enrollment.count({ where: { competitionId } }),
    ]);

    return {
      data,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }
}
