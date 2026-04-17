import { Request, Response, NextFunction } from 'express';
import { DiscussionService } from './discussion.service';
import { sendSuccess } from '../../utils/apiResponse';
import { VoteableType } from '@prisma/client';

const service = new DiscussionService();

export class DiscussionController {
  async createTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const topic = await service.createTopic(req.params.id, req.user!.userId, req.body.title, req.body.content);
      sendSuccess(res, topic, 'Tạo chủ đề thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async listTopics(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.listTopics(req.params.id, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async getTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const topic = await service.getTopic(req.params.id, req.params.discussionId);
      sendSuccess(res, topic);
    } catch (error) {
      next(error);
    }
  }

  async createReply(req: Request, res: Response, next: NextFunction) {
    try {
      const reply = await service.createReply(
        req.params.discussionId,
        req.user!.userId,
        req.body.content,
        req.body.parentReplyId
      );
      sendSuccess(res, reply, 'Tạo phản hồi thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async vote(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.body.type as VoteableType;
      const targetId = req.body.targetId || req.params.discussionId;
      const value = req.body.value as 1 | -1;
      const competitionId = req.params.id;
      const result = await service.vote(req.user!.userId, competitionId, type, targetId, value);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const topic = await service.updateTopic(req.params.discussionId, req.user!.userId, req.body.title, req.body.content);
      sendSuccess(res, topic, 'Cập nhật chủ đề thành công');
    } catch (error) {
      next(error);
    }
  }

  async deleteTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      await service.deleteTopic(req.params.discussionId, req.user!.userId, isAdmin);
      sendSuccess(res, null, 'Xóa chủ đề thành công');
    } catch (error) {
      next(error);
    }
  }

  async updateReply(req: Request, res: Response, next: NextFunction) {
    try {
      const reply = await service.updateReply(req.params.replyId, req.user!.userId, req.body.content);
      sendSuccess(res, reply, 'Cập nhật phản hồi thành công');
    } catch (error) {
      next(error);
    }
  }

  async deleteReply(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      await service.deleteReply(req.params.replyId, req.user!.userId, isAdmin);
      sendSuccess(res, null, 'Xóa phản hồi thành công');
    } catch (error) {
      next(error);
    }
  }

  async pin(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const result = await service.pinTopic(req.params.id, req.params.discussionId, req.body.isPinned, req.user!.userId, isAdmin);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
