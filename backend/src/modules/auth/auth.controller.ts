import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { auditLog, actorFromRequest } from '../../services/auditLog.service';

interface OAuthProfile {
  id: string;
  displayName?: string;
  username?: string;
  name?: string;
  email?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  profileUrl?: string;
}

const authService = new AuthService();
const mfaService = new MfaService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth/refresh',
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body);
      sendSuccess(res, user, 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh.', 201);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.body.token);
      sendSuccess(res, result, result.alreadyVerified ? 'Email đã được xác minh trước đó' : 'Xác minh email thành công');
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resendVerification(req.body.email);
      sendSuccess(res, null, 'Nếu email tồn tại và chưa xác minh, liên kết mới đã được gửi');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      if (result.mfaRequired) {
        sendSuccess(res, { mfaRequired: true, mfaToken: result.mfaToken }, 'Vui lòng nhập mã xác thực 2 yếu tố');
        return;
      }
      void auditLog.record({
        ...actorFromRequest(req),
        actorId: result.user.id,
        actorRole: result.user.role,
        action: 'auth.login',
        resource: 'user',
        resourceId: result.user.id,
      });
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  }

  async loginMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.loginMfa(req.body.mfaToken, req.body.code);
      void auditLog.record({
        ...actorFromRequest(req),
        actorId: result.user.id,
        actorRole: result.user.role,
        action: 'auth.login.mfa',
        resource: 'user',
        resourceId: result.user.id,
      });
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  }

  async mfaSetup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mfaService.setup(req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async mfaEnable(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mfaService.enable(req.user!.userId, req.body.code);
      void auditLog.record({
        ...actorFromRequest(req),
        action: 'auth.mfa.enable',
        resource: 'user',
        resourceId: req.user!.userId,
      });
      sendSuccess(res, result, 'Đã bật xác thực 2 yếu tố');
    } catch (error) {
      next(error);
    }
  }

  async mfaDisable(req: Request, res: Response, next: NextFunction) {
    try {
      await mfaService.disable(req.user!.userId, req.body.password);
      void auditLog.record({
        ...actorFromRequest(req),
        action: 'auth.mfa.disable',
        resource: 'user',
        resourceId: req.user!.userId,
      });
      sendSuccess(res, null, 'Đã tắt xác thực 2 yếu tố');
    } catch (error) {
      next(error);
    }
  }

  async mfaRegenerateBackupCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mfaService.regenerateBackupCodes(req.user!.userId, req.body.password);
      sendSuccess(res, result, 'Đã tạo lại mã dự phòng');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        throw new AppError('Không có refresh token', 401, 'NO_REFRESH_TOKEN');
      }
      const result = await authService.refreshToken(token);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: result.accessToken }, 'Làm mới phiên đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      sendSuccess(res, null, 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, null, 'Đặt lại mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.user!.userId);
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
      sendSuccess(res, null, 'Đăng xuất thành công');
    } catch (error) {
      next(error);
    }
  }

  async exchangeOAuthCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;

      const raw = await redis.get(`oauth:code:${code}`);
      if (!raw) throw new AppError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400);
      await redis.del(`oauth:code:${code}`);

      let tokens: { user?: unknown; accessToken?: string; refreshToken?: string };
      try {
        tokens = JSON.parse(raw);
      } catch {
        throw new AppError('Dữ liệu mã xác thực không hợp lệ', 400);
      }

      if (!tokens.accessToken || !tokens.refreshToken || !tokens.user) {
        throw new AppError('Dữ liệu mã xác thực bị lỗi', 400);
      }

      res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { user: tokens.user, accessToken: tokens.accessToken }, 'Đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      const profile = req.user as unknown as OAuthProfile;
      const emailEntry = profile.emails?.[0];
      if (emailEntry && emailEntry.verified === false) {
        return res.redirect(`${config.frontendUrl}/login?error=email_not_verified`);
      }
      const email = emailEntry?.value || profile.email;
      const name = profile.displayName || profile.name;
      if (!email || !name) {
        return res.redirect(`${config.frontendUrl}/login?error=oauth_missing_profile`);
      }
      const result = await authService.findOrCreateOAuthUser({
        email,
        name,
        avatarUrl: profile.photos?.[0]?.value,
        googleId: profile.id,
      });

      const code = crypto.randomBytes(32).toString('hex');
      await redis.set(`oauth:code:${code}`, JSON.stringify(result), 'EX', 60);
      res.redirect(`${config.frontendUrl}/auth/callback?code=${code}`);
    } catch (error) {
      res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
    }
  }

  async githubCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      const profile = req.user as unknown as OAuthProfile;
      const verifiedEmail = profile.emails?.find((e) => e.verified === true);
      const email = verifiedEmail?.value;
      if (!email) {
        const hasAnyEmail = (profile.emails?.length ?? 0) > 0;
        if (!hasAnyEmail) {
          return res.redirect(
            `${config.frontendUrl}/login?error=github_no_email&message=` +
            encodeURIComponent('Vui lòng thiết lập email công khai trên GitHub trước khi đăng nhập.')
          );
        }
        return res.redirect(`${config.frontendUrl}/login?error=email_not_verified`);
      }
      const name = profile.displayName || profile.username;
      if (!name) {
        return res.redirect(`${config.frontendUrl}/login?error=oauth_missing_profile`);
      }

      const result = await authService.findOrCreateOAuthUser({
        email,
        name,
        avatarUrl: profile.photos?.[0]?.value,
        githubId: profile.id,
        githubUrl: profile.profileUrl,
      });

      const code = crypto.randomBytes(32).toString('hex');
      await redis.set(`oauth:code:${code}`, JSON.stringify(result), 'EX', 60);
      res.redirect(`${config.frontendUrl}/auth/callback?code=${code}`);
    } catch (error) {
      res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
    }
  }
}
