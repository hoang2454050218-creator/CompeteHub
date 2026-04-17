import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { VoteableType } from '@prisma/client';
import { stripHtmlTags } from '../../utils/fileHelpers';

export class DiscussionService {
  async createTopic(competitionId: string, authorId: string, title: string, content: string) {
    const safeTitle = stripHtmlTags(title);
    const safeContent = stripHtmlTags(content);
    return prisma.discussion.create({
      data: { competitionId, authorId, title: safeTitle, content: safeContent },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async listTopics(competitionId: string, page = 1, limit = 20) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.discussion.findMany({
        where: { competitionId },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { replies: true } },
        },
      }),
      prisma.discussion.count({ where: { competitionId } }),
    ]);

    return {
      data,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async getTopic(competitionId: string, discussionId: string, replyPage = 1, replyLimit = 50) {
    const cappedReplyLimit = Math.min(Math.max(1, replyLimit), 100);
    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, competitionId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          where: { parentReplyId: null },
          orderBy: { createdAt: 'asc' },
          skip: (replyPage - 1) * cappedReplyLimit,
          take: cappedReplyLimit,
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            childReplies: {
              orderBy: { createdAt: 'asc' },
              take: 20,
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!discussion) throw new AppError('Discussion not found', 404);
    return discussion;
  }

  async createReply(discussionId: string, authorId: string, content: string, parentReplyId?: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!discussion) throw new AppError('Discussion not found', 404);

    if (parentReplyId) {
      const parent = await prisma.discussionReply.findUnique({ where: { id: parentReplyId } });
      if (!parent) throw new AppError('Parent reply not found', 404);
      if (parent.parentReplyId) throw new AppError('Cannot nest replies more than 2 levels', 400);
    }

    const safeContent = stripHtmlTags(content);
    return prisma.$transaction(async (tx) => {
      const reply = await tx.discussionReply.create({
        data: { discussionId, authorId, content: safeContent, parentReplyId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      await tx.discussion.update({
        where: { id: discussionId },
        data: { replyCount: { increment: 1 } },
      });
      return reply;
    });
  }

  async vote(userId: string, competitionId: string, voteableType: VoteableType, voteableId: string, value: 1 | -1) {
    if (voteableType === 'DISCUSSION') {
      const exists = await prisma.discussion.findFirst({
        where: { id: voteableId, competitionId },
      });
      if (!exists) throw new AppError('Discussion not found in this competition', 404);
    } else {
      const exists = await prisma.discussionReply.findFirst({
        where: { id: voteableId, discussion: { competitionId } },
      });
      if (!exists) throw new AppError('Reply not found in this competition', 404);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.vote.findUnique({
        where: { userId_voteableType_voteableId: { userId, voteableType, voteableId } },
      });

      let delta: number;
      let action: string;

      if (existing) {
        if (existing.value === value) {
          await tx.vote.delete({ where: { id: existing.id } });
          delta = -value;
          action = 'removed';
        } else {
          await tx.vote.update({ where: { id: existing.id }, data: { value } });
          delta = value * 2;
          action = 'changed';
        }
      } else {
        await tx.vote.create({ data: { userId, voteableType, voteableId, value } });
        delta = value;
        action = 'voted';
      }

      if (voteableType === 'DISCUSSION') {
        await tx.discussion.update({ where: { id: voteableId }, data: { upvoteCount: { increment: delta } } });
      } else {
        await tx.discussionReply.update({ where: { id: voteableId }, data: { upvoteCount: { increment: delta } } });
      }

      return { action };
    }, { isolationLevel: 'Serializable' });
  }

  async updateTopic(discussionId: string, userId: string, title?: string, content?: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!discussion) throw new AppError('Discussion not found', 404);
    if (discussion.authorId !== userId) throw new AppError('Not authorized', 403);

    const data: Record<string, string> = {};
    if (title) data.title = stripHtmlTags(title);
    if (content) data.content = stripHtmlTags(content);

    return prisma.discussion.update({
      where: { id: discussionId },
      data,
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async deleteTopic(discussionId: string, userId: string, isAdmin = false) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!discussion) throw new AppError('Discussion not found', 404);
    if (!isAdmin && discussion.authorId !== userId) throw new AppError('Not authorized', 403);

    await prisma.discussion.delete({ where: { id: discussionId } });
  }

  async updateReply(replyId: string, userId: string, content: string) {
    const reply = await prisma.discussionReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new AppError('Reply not found', 404);
    if (reply.authorId !== userId) throw new AppError('Not authorized', 403);

    return prisma.discussionReply.update({
      where: { id: replyId },
      data: { content: stripHtmlTags(content) },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async deleteReply(replyId: string, userId: string, isAdmin = false) {
    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      select: { id: true, authorId: true, discussionId: true },
    });
    if (!reply) throw new AppError('Reply not found', 404);
    if (!isAdmin && reply.authorId !== userId) throw new AppError('Not authorized', 403);

    await prisma.$transaction([
      prisma.discussionReply.delete({ where: { id: replyId } }),
      prisma.discussion.update({
        where: { id: reply.discussionId },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
  }

  async pinTopic(competitionId: string, discussionId: string, isPinned: boolean, userId: string, isAdmin: boolean) {
    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, competitionId },
      include: { competition: { select: { hostId: true } } },
    });
    if (!discussion) throw new AppError('Discussion not found in this competition', 404);

    if (!isAdmin && discussion.competition.hostId !== userId) {
      throw new AppError('Only the competition host or admin can pin topics', 403);
    }

    return prisma.discussion.update({
      where: { id: discussionId },
      data: { isPinned },
    });
  }
}
