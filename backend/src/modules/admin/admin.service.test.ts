import { createMockCompetition, createMockUser, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

const mockRedis = { get: jest.fn(), setex: jest.fn() };
jest.mock('../../config/redis', () => ({ redis: mockRedis }));

import { AdminService } from './admin.service';

const service = new AdminService();
beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.setex.mockResolvedValue('OK');
});

describe('AdminService.getDashboard', () => {
  it('returns stats and recent data', async () => {
    mockPrisma.user.count.mockResolvedValue(100);
    mockPrisma.competition.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5);
    mockPrisma.submission.count.mockResolvedValue(1000);
    mockPrisma.user.findMany.mockResolvedValue([createMockUser()]);
    mockPrisma.$queryRaw.mockResolvedValue([{ date: '2024-01-01', count: BigInt(10) }]);

    const result = await service.getDashboard();
    expect(result.stats.totalUsers).toBe(100);
    expect(result.stats.totalCompetitions).toBe(50);
    expect(result.stats.totalSubmissions).toBe(1000);
    expect(result.recentUsers).toHaveLength(1);
  });
});

describe('AdminService.reviewCompetition', () => {
  it('approves competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'PENDING_REVIEW' }));
    mockPrisma.competition.update.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));

    const result = await service.reviewCompetition('comp-1', 'approve');
    expect(mockPrisma.competition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } })
    );
  });

  it('rejects competition (back to DRAFT)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'PENDING_REVIEW' }));
    mockPrisma.competition.update.mockResolvedValue(createMockCompetition({ status: 'DRAFT' }));

    await service.reviewCompetition('comp-1', 'reject');
    expect(mockPrisma.competition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DRAFT' } })
    );
  });

  it('throws for non-PENDING competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    await expect(service.reviewCompetition('comp-1', 'approve'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws for non-existent competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(null);
    await expect(service.reviewCompetition('no', 'approve'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AdminService.listUsers', () => {
  it('returns paginated users with search', async () => {
    mockPrisma.user.findMany.mockResolvedValue([createMockUser()]);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await service.listUsers(1, 20, 'test');
    expect(result.data).toHaveLength(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it('filters by role', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await service.listUsers(1, 20, undefined, 'HOST');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'HOST' }),
      })
    );
  });
});

describe('AdminService.updateUser', () => {
  it('updates user role', async () => {
    mockPrisma.user.update.mockResolvedValue(createMockUser({ role: 'HOST' }));
    const result = await service.updateUser('user-1', { role: 'HOST' });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: 'HOST' },
      })
    );
  });

  it('toggles user active state', async () => {
    mockPrisma.user.update.mockResolvedValue(createMockUser({ isActive: false }));
    await service.updateUser('user-1', { isActive: false });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      })
    );
  });
});
