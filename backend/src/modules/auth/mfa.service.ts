import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../utils/apiResponse';
import { BadgeService } from '../badge/badge.service';

const badgeService = new BadgeService();

const MFA_ISSUER = process.env.MFA_ISSUER || 'CompeteHub';
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 10;

authenticator.options = { window: 1 };

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH).toString('hex').slice(0, BACKUP_CODE_LENGTH).toUpperCase();
    plain.push(code);
    hashed.push(bcrypt.hashSync(code, config.auth.bcryptRounds));
  }
  return { plain, hashed };
}

export class MfaService {
  async setup(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    if (user.totpEnabled) {
      throw new AppError('MFA đã được bật. Hãy tắt trước khi cấu hình lại.', 400, 'MFA_ALREADY_ENABLED');
    }

    const secret = authenticator.generateSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    const otpauth = authenticator.keyuri(user.email, MFA_ISSUER, secret);
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    return { secret, otpauth, qrDataUrl };
  }

  async enable(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new AppError('Vui lòng khởi tạo MFA trước', 400, 'MFA_NOT_INITIALIZED');
    }
    if (user.totpEnabled) {
      throw new AppError('MFA đã được bật', 400, 'MFA_ALREADY_ENABLED');
    }

    const valid = authenticator.check(code, user.totpSecret);
    if (!valid) {
      throw new AppError('Mã xác thực không đúng', 400, 'INVALID_MFA_CODE');
    }

    const { plain, hashed } = generateBackupCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpBackupCodes: hashed },
    });

    void badgeService.evaluate({ kind: 'mfa_enabled', userId });
    return { backupCodes: plain };
  }

  async disable(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new AppError('Không thể tắt MFA cho tài khoản này', 400, 'CANNOT_DISABLE_MFA');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
      },
    });
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) return false;

    const trimmed = code.replace(/\s+/g, '').toUpperCase();
    if (/^[0-9]{6,8}$/.test(trimmed)) {
      return authenticator.check(trimmed, user.totpSecret);
    }

    for (let i = 0; i < user.totpBackupCodes.length; i++) {
      const hashed = user.totpBackupCodes[i];
      if (await bcrypt.compare(trimmed, hashed)) {
        const remaining = [...user.totpBackupCodes];
        remaining.splice(i, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodes: remaining },
        });
        return true;
      }
    }
    return false;
  }

  async regenerateBackupCodes(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash || !user.totpEnabled) {
      throw new AppError('MFA chưa được bật', 400, 'MFA_NOT_ENABLED');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }
    const { plain, hashed } = generateBackupCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: hashed },
    });
    return { backupCodes: plain };
  }
}
