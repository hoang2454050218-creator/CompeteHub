import { Request, Response, NextFunction } from 'express';
import { TeamService } from './team.service';
import { sendSuccess } from '../../utils/apiResponse';

const service = new TeamService();

export class TeamController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const team = await service.create(req.user!.userId, req.body.competitionId, req.body.name);
      sendSuccess(res, team, 'Tạo đội thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async invite(req: Request, res: Response, next: NextFunction) {
    try {
      const invitation = await service.invite(req.params.id, req.user!.userId, req.body.email);
      sendSuccess(res, invitation, 'Gửi lời mời thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  async respond(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.respondToInvitation(req.params.invitationId, req.user!.userId, req.body.accept);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const team = await service.getTeam(req.params.id, req.user?.userId);
      sendSuccess(res, team);
    } catch (error) {
      next(error);
    }
  }

  async getMyInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await service.getMyInvitations(req.user!.userId, page, limit);
      sendSuccess(res, result.data, 'Thành công', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}
