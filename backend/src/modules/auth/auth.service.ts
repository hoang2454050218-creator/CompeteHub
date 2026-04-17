import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { config } from '../../config';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { AppError } from '../../utils/apiResponse';
import { RegisterInput, LoginInput } from './auth.validator';
import { EmailService } from '../../services/email.service';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const emailService = new EmailService();

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('Email đã được sử dụng', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, config.auth.bcryptRounds);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return user;
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị vô hiệu hóa', 403, 'ACCOUNT_DEACTIVATED');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Tài khoản đã bị khóa. Vui lòng thử lại sau ${minutesLeft} phút`, 429, 'ACCOUNT_LOCKED');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      const failedLogins = user.failedLogins + 1;
      const updateData: { failedLogins: number; lockedUntil?: Date } = { failedLogins };

      if (failedLogins >= config.auth.maxFailedLogins) {
        updateData.lockedUntil = new Date(Date.now() + config.auth.lockDurationMinutes * 60000);
        updateData.failedLogins = 0;
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    const tokens = this.generateTokens(user.id, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(tokens.refreshToken) },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

      if (!user) {
        throw new AppError('Refresh token không hợp lệ', 401, 'INVALID_TOKEN');
      }

      if (user.refreshToken !== hashToken(refreshToken)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        throw new AppError('Phát hiện token bị tái sử dụng. Tất cả phiên đăng nhập đã bị thu hồi', 401, 'TOKEN_REUSE');
      }

      const tokens = this.generateTokens(user.id, user.role);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashToken(tokens.refreshToken) },
      });

      return tokens;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Refresh token không hợp lệ', 401, 'INVALID_TOKEN');
    }
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExp = new Date(Date.now() + config.auth.resetTokenExpiryHours * 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashToken(resetToken), resetTokenExp },
    });

    try {
      await emailService.sendPasswordReset(user.email, user.name, resetToken);
    } catch {
      // Email delivery failure should not block the flow
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExp: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400, 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);

    // AUDIT-FIX: Invalidate all sessions on password reset
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExp: null,
        refreshToken: null,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        bio: true,
        role: true,
        githubUrl: true,
        linkedinUrl: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    return user;
  }

  async findOrCreateOAuthUser(profile: {
    email: string;
    name: string;
    avatarUrl?: string;
    googleId?: string;
    githubId?: string;
    githubUrl?: string;
  }) {
    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (user) {
      const isNewOAuthProvider =
        (profile.googleId && !user.googleId) ||
        (profile.githubId && !user.githubId);
      if (isNewOAuthProvider && user.passwordHash && !user.googleId && !user.githubId) {
        throw new AppError(
          'Tài khoản với email này đã tồn tại. Vui lòng đăng nhập bằng mật khẩu trước, sau đó liên kết tài khoản OAuth trong phần cài đặt.',
          409,
          'ACCOUNT_EXISTS'
        );
      }

      const updateData: Record<string, string> = {};
      if (profile.googleId && !user.googleId) updateData.googleId = profile.googleId;
      if (profile.githubId && !user.githubId) updateData.githubId = profile.githubId;
      if (profile.avatarUrl && !user.avatarUrl) updateData.avatarUrl = profile.avatarUrl;
      if (profile.githubUrl) updateData.githubUrl = profile.githubUrl;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updateData });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          googleId: profile.googleId,
          githubId: profile.githubId,
          githubUrl: profile.githubUrl,
        },
      });
    }

    const tokens = this.generateTokens(user.id, user.role);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(tokens.refreshToken) },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
      ...tokens,
    };
  }

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private generateTokens(userId: string, role: string) {
    return {
      accessToken: generateAccessToken({ userId, role }),
      refreshToken: generateRefreshToken({ userId, role }),
    };
  }
}
