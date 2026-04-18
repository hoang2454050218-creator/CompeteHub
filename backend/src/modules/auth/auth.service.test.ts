import bcrypt from 'bcryptjs';
import { createMockUser, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { AuthService } from './auth.service';

const service = new AuthService();

beforeEach(() => jest.clearAllMocks());

describe('AuthService.register', () => {
  it('creates user with hashed password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createMockUser({ id: 'new-id' }));

    const result = await service.register({ email: 'new@test.com', password: 'password123', name: 'New User' });
    expect(result).toBeDefined();
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@test.com',
          name: 'New User',
        }),
      })
    );
    const createdData = mockPrisma.user.create.mock.calls[0][0].data;
    expect(createdData.passwordHash).toBeDefined();
    expect(createdData.passwordHash).not.toBe('password123');
  });

  it('throws 409 for duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    await expect(service.register({ email: 'test@test.com', password: 'password123', name: 'Dup' }))
      .rejects.toMatchObject({ statusCode: 409, errorCode: 'EMAIL_EXISTS' });
  });
});

describe('AuthService.login', () => {
  it('returns tokens on valid credentials', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const result = await service.login({ email: 'test@test.com', password: 'correct' });
    if (result.mfaRequired) throw new Error('Expected non-MFA login result');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });

  it('returns mfaRequired when totp enabled', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, totpEnabled: true }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const result = await service.login({ email: 'test@test.com', password: 'correct' });
    expect(result.mfaRequired).toBe(true);
    if (result.mfaRequired) {
      expect(result.mfaToken).toBeDefined();
    }
  });

  it('throws 403 when email is not verified', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, emailVerified: false }));
    await expect(service.login({ email: 'test@test.com', password: 'correct' }))
      .rejects.toMatchObject({ statusCode: 403, errorCode: 'EMAIL_NOT_VERIFIED' });
  });

  it('throws 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, failedLogins: 0 }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 for non-existent email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'no@test.com', password: 'any' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 for inactive account', async () => {
    const hash = await bcrypt.hash('pass', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, isActive: false }));
    await expect(service.login({ email: 't@t.com', password: 'pass' }))
      .rejects.toMatchObject({ statusCode: 403, errorCode: 'ACCOUNT_DEACTIVATED' });
  });

  it('throws 429 for locked account', async () => {
    const hash = await bcrypt.hash('pass', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({
      passwordHash: hash,
      lockedUntil: new Date(Date.now() + 600000),
    }));
    await expect(service.login({ email: 't@t.com', password: 'pass' }))
      .rejects.toMatchObject({ statusCode: 429, errorCode: 'ACCOUNT_LOCKED' });
  });

  it('increments failedLogins on wrong password', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, failedLogins: 2 }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await expect(service.login({ email: 't@t.com', password: 'wrong' })).rejects.toThrow();
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLogins: 3 }),
      })
    );
  });

  it('locks account after 5 failed attempts', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, failedLogins: 4 }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await expect(service.login({ email: 't@t.com', password: 'wrong' })).rejects.toThrow();
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
          failedLogins: 0,
        }),
      })
    );
  });
});

describe('AuthService.refreshToken', () => {
  it('returns new tokens for valid refresh token', async () => {
    const crypto = require('crypto');
    const { generateRefreshToken } = require('../../utils/jwt');
    const refreshToken = generateRefreshToken({ userId: 'user-1', role: 'PARTICIPANT' });
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ refreshToken: hashedToken }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const result = await service.refreshToken(refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('throws for invalid refresh token', async () => {
    await expect(service.refreshToken('invalid-token'))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.forgotPassword', () => {
  it('creates reset token for existing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await service.forgotPassword('test@test.com');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExp: expect.any(Date),
        }),
      })
    );
  });

  it('returns undefined for non-existent email (silent)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await service.forgotPassword('none@test.com');
    expect(result).toBeUndefined();
  });
});

describe('AuthService.resetPassword', () => {
  it('resets password with valid token', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await service.resetPassword('valid-token', 'newpassword123');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resetToken: null,
          resetTokenExp: null,
          failedLogins: 0,
          lockedUntil: null,
        }),
      })
    );
  });

  it('throws for invalid/expired token', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword('bad-token', 'newpass123'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_TOKEN' });
  });
});

describe('AuthService.getMe', () => {
  it('returns user data', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    const result = await service.getMe('user-1');
    expect(result).toBeDefined();
  });

  it('throws 404 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getMe('no-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AuthService.findOrCreateOAuthUser', () => {
  it('creates new user if not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createMockUser({ googleId: 'g1' }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const result = await service.findOrCreateOAuthUser({
      email: 'oauth@test.com', name: 'OAuth User', googleId: 'g1',
    });
    expect(result.accessToken).toBeDefined();
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });

  it('links OAuth to existing user that already has OAuth', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ googleId: 'existing-g1' }));
    mockPrisma.user.update.mockResolvedValue(createMockUser({ googleId: 'existing-g1', githubId: 'gh1' }));

    const result = await service.findOrCreateOAuthUser({
      email: 'test@example.com', name: 'Test', githubId: 'gh1',
    });
    expect(result.accessToken).toBeDefined();
  });

  it('blocks OAuth link when user has password only', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: '$2a$12$hash', googleId: null, githubId: null }));

    await expect(
      service.findOrCreateOAuthUser({ email: 'test@example.com', name: 'Test', googleId: 'g1' })
    ).rejects.toMatchObject({ statusCode: 409, errorCode: 'ACCOUNT_EXISTS' });
  });
});

describe('AuthService.logout', () => {
  it('clears refresh token', async () => {
    mockPrisma.user.update.mockResolvedValue(createMockUser());
    await service.logout('user-1');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { refreshToken: null },
      })
    );
  });
});
