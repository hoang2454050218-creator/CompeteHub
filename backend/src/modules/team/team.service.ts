import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { stripHtmlTags } from '../../utils/fileHelpers';
import { Prisma } from '@prisma/client';

export class TeamService {
  async create(userId: string, competitionId: string, rawName: string) {
    const name = stripHtmlTags(rawName);
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Competition not found', 404);
    if (competition.maxTeamSize <= 1) throw new AppError('Teams are not enabled for this competition', 400);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
    });
    if (!enrollment) throw new AppError('You must be enrolled', 403);
    if (enrollment.teamId) throw new AppError('You are already in a team', 400);

    try {
      return await prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: { competitionId, leaderId: userId, name },
        });
        await tx.enrollment.update({
          where: { userId_competitionId: { userId, competitionId } },
          data: { teamId: team.id },
        });
        return team;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('A team with this name already exists in the competition', 409);
      }
      throw err;
    }
  }

  async invite(teamId: string, senderId: string, receiverEmail: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { competition: true, members: true },
    });
    if (!team) throw new AppError('Team not found', 404);
    if (team.leaderId !== senderId) throw new AppError('Only team leader can invite', 403);
    if (team.members.length >= team.competition.maxTeamSize) {
      throw new AppError('Team is full', 400);
    }

    if (team.competition.mergeDeadline && new Date() > team.competition.mergeDeadline) {
      throw new AppError('Merge deadline has passed', 400);
    }

    const receiver = await prisma.user.findUnique({ where: { email: receiverEmail } });
    if (!receiver) throw new AppError('User not found', 404);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_competitionId: { userId: receiver.id, competitionId: team.competitionId } },
    });
    if (!enrollment) throw new AppError('User must be enrolled in the competition', 400);
    if (enrollment.teamId) {
      throw new AppError('User is already in a team for this competition', 400, 'ALREADY_IN_TEAM');
    }

    try {
      return await prisma.teamInvitation.create({
        data: { teamId, senderId, receiverId: receiver.id },
        include: {
          team: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('Invitation already sent to this user', 409);
      }
      throw err;
    }
  }

  async respondToInvitation(invitationId: string, userId: string, accept: boolean) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: { include: { competition: true } } },
    });

    if (!invitation) throw new AppError('Invitation not found', 404);
    if (invitation.receiverId !== userId) throw new AppError('Not authorized', 403);
    if (invitation.status !== 'PENDING') throw new AppError('Invitation already responded to', 400);

    if (accept) {
      if (invitation.team.competition.mergeDeadline && new Date() > invitation.team.competition.mergeDeadline) {
        throw new AppError('Cannot join team after merge deadline has passed', 400, 'MERGE_DEADLINE_PASSED');
      }

      await prisma.$transaction(async (tx) => {
        const currentMembers = await tx.enrollment.count({
          where: { teamId: invitation.teamId },
        });
        if (currentMembers >= invitation.team.competition.maxTeamSize) {
          throw new AppError('Team is full', 400);
        }

        const userEnrollment = await tx.enrollment.findUnique({
          where: { userId_competitionId: { userId, competitionId: invitation.team.competitionId } },
        });
        if (userEnrollment?.teamId) {
          throw new AppError('You are already in a team', 400);
        }

        await tx.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        });
        await tx.enrollment.update({
          where: { userId_competitionId: { userId, competitionId: invitation.team.competitionId } },
          data: { teamId: invitation.teamId },
        });
      }, { isolationLevel: 'Serializable' });
    } else {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' },
      });
    }

    return { accepted: accept };
  }

  async getTeam(teamId: string, requestUserId?: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        leader: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        competition: { select: { id: true, hostId: true } },
      },
    });
    if (!team) throw new AppError('Team not found', 404);

    const isMember = team.members.some((m) => m.userId === requestUserId);
    const isHostOrAdmin = team.competition.hostId === requestUserId;

    const result: Record<string, unknown> = {
      id: team.id,
      name: team.name,
      leader: team.leader,
      members: team.members,
      competitionId: team.competitionId,
    };

    if (isMember || isHostOrAdmin) {
      const invitations = await prisma.teamInvitation.findMany({
        where: { teamId, status: 'PENDING' },
        include: { receiver: { select: { id: true, name: true } } },
      });
      result.invitations = invitations;
    }

    return result;
  }

  async getMyInvitations(userId: string, page = 1, limit = 50) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.teamInvitation.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              competition: { select: { id: true, title: true, slug: true } },
            },
          },
          sender: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
      }),
      prisma.teamInvitation.count({ where: { receiverId: userId, status: 'PENDING' } }),
    ]);

    return {
      data,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }
}
