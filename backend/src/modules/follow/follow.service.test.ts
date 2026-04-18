import { createMockUser, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../notification/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
}));

import { FollowService } from './follow.service';

const service = new FollowService();

beforeEach(() => jest.clearAllMocks());

function buildTx() {
  return {
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      update: jest.fn().mockResolvedValue(createMockUser()),
    },
  };
}

describe('FollowService.follow', () => {
  it('rejects self-follow', async () => {
    await expect(service.follow('a', 'a')).rejects.toMatchObject({ errorCode: 'SELF_FOLLOW' });
  });

  it('returns 404 for unknown target', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.follow('a', 'b')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates follow + increments counters when not already following', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ id: 'b' }));
    const tx = buildTx();
    tx.follow.findUnique.mockResolvedValue(null);
    tx.follow.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.follow('a', 'b');
    expect(result.followed).toBe(true);
    expect(tx.follow.create).toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledTimes(2);
  });

  it('is idempotent: returns followed=false if already following', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ id: 'b' }));
    const tx = buildTx();
    tx.follow.findUnique.mockResolvedValue({ followerId: 'a', followingId: 'b' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.follow('a', 'b');
    expect(result.followed).toBe(false);
    expect(tx.follow.create).not.toHaveBeenCalled();
  });
});

describe('FollowService.unfollow', () => {
  it('removes follow + decrements counters', async () => {
    const tx = buildTx();
    tx.follow.findUnique.mockResolvedValue({ followerId: 'a', followingId: 'b' });
    tx.follow.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.unfollow('a', 'b');
    expect(result.unfollowed).toBe(true);
    expect(tx.user.update).toHaveBeenCalledTimes(2);
  });

  it('is idempotent: returns unfollowed=false if not following', async () => {
    const tx = buildTx();
    tx.follow.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await service.unfollow('a', 'b');
    expect(result.unfollowed).toBe(false);
  });
});

describe('FollowService.isFollowing', () => {
  it('returns true when found', async () => {
    mockPrisma.follow.findUnique.mockResolvedValue({ followerId: 'a', followingId: 'b' });
    expect(await service.isFollowing('a', 'b')).toBe(true);
  });
  it('returns false when not found', async () => {
    mockPrisma.follow.findUnique.mockResolvedValue(null);
    expect(await service.isFollowing('a', 'b')).toBe(false);
  });
});
