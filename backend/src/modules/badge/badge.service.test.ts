import { mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../notification/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
}));

import { BadgeService } from './badge.service';

const service = new BadgeService();

beforeEach(() => jest.clearAllMocks());

describe('BadgeService.award', () => {
  it('creates user badge when badge code exists', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue({ id: 'b1', name: 'First Submission' });
    mockPrisma.userBadge.create.mockResolvedValue({});
    const ok = await service.award('user-1', 'FIRST_SUBMISSION');
    expect(ok).toBe(true);
    expect(mockPrisma.userBadge.create).toHaveBeenCalled();
  });

  it('returns false when badge code unknown', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue(null);
    const ok = await service.award('user-1', 'NOT_REAL');
    expect(ok).toBe(false);
  });

  it('is idempotent: swallows duplicate constraint errors', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue({ id: 'b1', name: 'X' });
    mockPrisma.userBadge.create.mockRejectedValue(new Error('unique violation'));
    const ok = await service.award('user-1', 'X');
    expect(ok).toBe(false);
  });
});

describe('BadgeService.evaluate', () => {
  it('awards FIRST_SUBMISSION on first scored submission', async () => {
    mockPrisma.submission.count.mockResolvedValue(1);
    mockPrisma.badge.findUnique.mockImplementation(({ where: { code } }: any) => Promise.resolve({ id: code, name: code }));
    mockPrisma.userBadge.create.mockResolvedValue({});
    await service.evaluate({ kind: 'submission_scored', userId: 'u1', competitionId: 'c1' });
    const codes = mockPrisma.badge.findUnique.mock.calls.map((c: any) => c[0].where.code);
    expect(codes).toContain('FIRST_SUBMISSION');
  });

  it('awards TEN_SUBMISSIONS at 10', async () => {
    mockPrisma.submission.count.mockResolvedValue(10);
    mockPrisma.badge.findUnique.mockImplementation(({ where: { code } }: any) => Promise.resolve({ id: code, name: code }));
    mockPrisma.userBadge.create.mockResolvedValue({});
    await service.evaluate({ kind: 'submission_scored', userId: 'u1', competitionId: 'c1' });
    const codes = mockPrisma.badge.findUnique.mock.calls.map((c: any) => c[0].where.code);
    expect(codes).toContain('TEN_SUBMISSIONS');
  });

  it('awards COMPETITION_WINNER for rank 1', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue({ id: 'WINNER', name: 'Winner' });
    mockPrisma.userBadge.create.mockResolvedValue({});
    await service.evaluate({ kind: 'leaderboard_finalized', userId: 'u1', competitionId: 'c1', rank: 1 });
    expect(mockPrisma.badge.findUnique).toHaveBeenCalledWith({ where: { code: 'COMPETITION_WINNER' } });
  });

  it('awards TOP_10 for rank 2-10', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue({ id: 'TOP10', name: 'Top 10' });
    mockPrisma.userBadge.create.mockResolvedValue({});
    await service.evaluate({ kind: 'leaderboard_finalized', userId: 'u1', competitionId: 'c1', rank: 5 });
    expect(mockPrisma.badge.findUnique).toHaveBeenCalledWith({ where: { code: 'TOP_10' } });
  });

  it('awards HELPFUL when upvote count crosses 10', async () => {
    mockPrisma.badge.findUnique.mockResolvedValue({ id: 'HELPFUL', name: 'Helpful' });
    mockPrisma.userBadge.create.mockResolvedValue({});
    await service.evaluate({ kind: 'vote_received', userId: 'u1', upvoteCount: 10 });
    expect(mockPrisma.badge.findUnique).toHaveBeenCalledWith({ where: { code: 'HELPFUL' } });
  });
});
