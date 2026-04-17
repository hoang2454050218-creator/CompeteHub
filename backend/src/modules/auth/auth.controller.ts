import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';
import { config } from '../../config';
import { redis } from '../../config/redis';

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
      sendSuccess(res, user, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
      }
      const result = await authService.refreshToken(token);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: result.accessToken }, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      sendSuccess(res, null, 'If that email exists, a reset link has been sent');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, null, 'Password reset successful');
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
      sendSuccess(res, null, 'Logged out');
    } catch (error) {
      next(error);
    }
  }

  async exchangeOAuthCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;

      const raw = await redis.get(`oauth:code:${code}`);
      if (!raw) throw new AppError('Invalid or expired authorization code', 400);
      await redis.del(`oauth:code:${code}`);

      let tokens: { user?: unknown; accessToken?: string; refreshToken?: string };
      try {
        tokens = JSON.parse(raw);
      } catch {
        throw new AppError('Invalid authorization code data', 400);
      }

      if (!tokens.accessToken || !tokens.refreshToken || !tokens.user) {
        throw new AppError('Malformed authorization code data', 400);
      }

      res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
      sendSuccess(res, { user: tokens.user, accessToken: tokens.accessToken }, 'Login successful');
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
      const emailEntry = profile.emails?.[0];
      const email = emailEntry?.value;
      if (!email) {
        return res.redirect(
          `${config.frontendUrl}/login?error=github_no_email&message=` +
          encodeURIComponent('Please set a public email on GitHub before signing in.')
        );
      }
      if (emailEntry.verified === false) {
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
