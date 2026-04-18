import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { createMockUser, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { MfaService } from './mfa.service';

const service = new MfaService();

beforeEach(() => jest.clearAllMocks());

describe('MfaService.setup', () => {
  it('returns secret + QR data url and stores secret on user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpEnabled: false, totpSecret: null }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const result = await service.setup('user-1');
    expect(result.secret).toBeDefined();
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totpSecret: result.secret }),
    }));
  });

  it('refuses if MFA already enabled', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpEnabled: true, totpSecret: 'X' }));
    await expect(service.setup('user-1')).rejects.toMatchObject({ errorCode: 'MFA_ALREADY_ENABLED' });
  });
});

describe('MfaService.enable', () => {
  it('enables MFA when valid TOTP code provided', async () => {
    const secret = authenticator.generateSecret();
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpSecret: secret, totpEnabled: false }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const code = authenticator.generate(secret);
    const result = await service.enable('user-1', code);
    expect(result.backupCodes).toHaveLength(8);
    const updateArgs = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.totpEnabled).toBe(true);
    expect(updateArgs.data.totpBackupCodes).toHaveLength(8);
  });

  it('rejects invalid code', async () => {
    const secret = authenticator.generateSecret();
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpSecret: secret, totpEnabled: false }));
    await expect(service.enable('user-1', '000000')).rejects.toMatchObject({ errorCode: 'INVALID_MFA_CODE' });
  });

  it('refuses if setup not initialised', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpSecret: null }));
    await expect(service.enable('user-1', '123456')).rejects.toMatchObject({ errorCode: 'MFA_NOT_INITIALIZED' });
  });
});

describe('MfaService.verify', () => {
  it('accepts current TOTP code', async () => {
    const secret = authenticator.generateSecret();
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpSecret: secret, totpEnabled: true }));
    const code = authenticator.generate(secret);
    expect(await service.verify('user-1', code)).toBe(true);
  });

  it('rejects code when MFA disabled', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ totpEnabled: false }));
    expect(await service.verify('user-1', '123456')).toBe(false);
  });

  it('consumes a backup code on successful match and removes it', async () => {
    const backup = 'BACKUPCODE';
    const hashed = await bcrypt.hash(backup, 4);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({
      totpSecret: 'WHATEVER',
      totpEnabled: true,
      totpBackupCodes: [hashed, 'OTHER'],
    }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    const ok = await service.verify('user-1', backup);
    expect(ok).toBe(true);
    const args = mockPrisma.user.update.mock.calls[0][0];
    expect(args.data.totpBackupCodes).toEqual(['OTHER']);
  });
});

describe('MfaService.disable', () => {
  it('clears MFA fields when password is correct', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, totpEnabled: true }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await service.disable('user-1', 'correct');
    const args = mockPrisma.user.update.mock.calls[0][0];
    expect(args.data.totpEnabled).toBe(false);
    expect(args.data.totpSecret).toBeNull();
    expect(args.data.totpBackupCodes).toEqual([]);
  });

  it('rejects wrong password', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash, totpEnabled: true }));
    await expect(service.disable('user-1', 'wrong'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
  });
});
