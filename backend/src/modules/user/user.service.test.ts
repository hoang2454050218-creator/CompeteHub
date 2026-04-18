import bcrypt from 'bcryptjs';
import { createMockUser, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { UserService } from './user.service';

const service = new UserService();

beforeEach(() => jest.clearAllMocks());

describe('UserService.getProfile', () => {
  it('returns public fields without email when not own profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ name: 'Public', email: 'p@p.com' }));
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
    mockPrisma.userBadge.findMany.mockResolvedValue([]);

    await service.getProfile('user-1', false);
    const args = mockPrisma.user.findUnique.mock.calls[0][0];
    expect(args.select.email).toBeUndefined();
    expect(args.select.totpEnabled).toBeUndefined();
  });

  it('exposes private fields when own profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
    mockPrisma.userBadge.findMany.mockResolvedValue([]);

    await service.getProfile('user-1', true);
    const args = mockPrisma.user.findUnique.mock.calls[0][0];
    expect(args.select.email).toBe(true);
    expect(args.select.totpEnabled).toBe(true);
    expect(args.select.notificationPreferences).toBe(true);
  });

  it('throws 404 when user does not exist or is deleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getProfile('missing', false)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UserService.exportUserData (GDPR)', () => {
  it('aggregates every user-owned record', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.enrollment.findMany.mockResolvedValue([{ id: 'e1' }]);
    mockPrisma.submission.findMany.mockResolvedValue([{ id: 's1' }]);
    mockPrisma.vote.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.discussion.findMany.mockResolvedValue([]);
    mockPrisma.discussionReply.findMany.mockResolvedValue([]);
    mockPrisma.team.findMany.mockResolvedValue([]);
    mockPrisma.teamInvitation.findMany.mockResolvedValue([]);
    mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
    mockPrisma.userBadge.findMany.mockResolvedValue([]);
    mockPrisma.follow.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const data = await service.exportUserData('user-1');
    expect(data.user).toBeDefined();
    expect(data.enrollments).toHaveLength(1);
    expect(data.submissions).toHaveLength(1);
    expect(data.exportedAt).toBeDefined();
  });
});

describe('UserService.deleteAccount (GDPR anonymize)', () => {
  it('anonymizes profile when password matches', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash }));
    mockPrisma.user.update.mockResolvedValue(createMockUser());

    await service.deleteAccount('user-1', 'correct');
    const args = mockPrisma.user.update.mock.calls[0][0];
    expect(args.data.email).toMatch(/^deleted_/);
    expect(args.data.name).toBe('Người dùng đã xoá');
    expect(args.data.passwordHash).toBeNull();
    expect(args.data.totpEnabled).toBe(false);
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(args.data.isActive).toBe(false);
  });

  it('rejects wrong password', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: hash }));
    await expect(service.deleteAccount('user-1', 'wrong'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
  });

  it('rejects OAuth-only accounts (no password to verify)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ passwordHash: null, googleId: 'g1' }));
    await expect(service.deleteAccount('user-1', 'whatever'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'OAUTH_ACCOUNT' });
  });
});

describe('UserService.updateNotificationPreferences', () => {
  it('persists preferences map to user record', async () => {
    mockPrisma.user.update.mockResolvedValue(createMockUser());
    await service.updateNotificationPreferences('user-1', { SUBMISSION_SCORED: false, NEW_FOLLOWER: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationPreferences: { SUBMISSION_SCORED: false, NEW_FOLLOWER: true } }),
    }));
  });
});

describe('UserService.updateProfile', () => {
  it('strips HTML tags from name and bio', async () => {
    mockPrisma.user.update.mockResolvedValue(createMockUser());
    await service.updateProfile('user-1', { name: '<script>x</script>Real', bio: '<b>hi</b> there' });
    const args = mockPrisma.user.update.mock.calls[0][0];
    expect(args.data.name).not.toMatch(/script/);
    expect(args.data.bio).not.toMatch(/<b>/);
  });
});
