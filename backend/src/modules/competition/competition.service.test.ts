import { createMockCompetition, mockPrismaClient } from '../../tests/helpers';
import { CompetitionStatus } from '@prisma/client';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { CompetitionService } from './competition.service';

const service = new CompetitionService();

beforeEach(() => jest.clearAllMocks());

describe('CompetitionService.create', () => {
  it('creates competition with generated slug', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(null);
    mockPrisma.competition.create.mockResolvedValue(createMockCompetition({ slug: 'test-competition' }));

    const result = await service.create('host-1', {
      title: 'Test Competition',
      evalMetric: 'ACCURACY',
      category: 'COMMUNITY',
      tags: [],
      pubPrivSplit: 0.3,
      maxTeamSize: 1,
      maxDailySubs: 5,
      maxFileSize: 104857600,
    });

    expect(result.slug).toBe('test-competition');
    expect(mockPrisma.competition.create).toHaveBeenCalled();
  });

  it('appends number for duplicate slug', async () => {
    mockPrisma.competition.findUnique
      .mockResolvedValueOnce(createMockCompetition())
      .mockResolvedValueOnce(null);
    mockPrisma.competition.create.mockResolvedValue(createMockCompetition({ slug: 'test-competition-1' }));

    const result = await service.create('host-1', {
      title: 'Test Competition',
      evalMetric: 'ACCURACY',
      category: 'COMMUNITY',
      tags: [],
      pubPrivSplit: 0.3,
      maxTeamSize: 1,
      maxDailySubs: 5,
      maxFileSize: 104857600,
    });

    expect(result.slug).toBe('test-competition-1');
  });
});

describe('CompetitionService.list', () => {
  it('returns paginated results', async () => {
    mockPrisma.competition.findMany.mockResolvedValue([createMockCompetition()]);
    mockPrisma.competition.count.mockResolvedValue(1);

    const result = await service.list({ sort: 'newest', page: 1, limit: 12 });
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('applies status filter', async () => {
    mockPrisma.competition.findMany.mockResolvedValue([]);
    mockPrisma.competition.count.mockResolvedValue(0);

    await service.list({ status: 'ACTIVE', sort: 'newest', page: 1, limit: 12 });
    expect(mockPrisma.competition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
  });

  it('applies search filter', async () => {
    mockPrisma.competition.findMany.mockResolvedValue([]);
    mockPrisma.competition.count.mockResolvedValue(0);

    await service.list({ search: 'titanic', sort: 'newest', page: 1, limit: 12 });
    expect(mockPrisma.competition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });
});

describe('CompetitionService.getBySlug', () => {
  it('returns competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition());
    const result = await service.getBySlug('test-competition');
    expect(result.title).toBe('Test Competition');
  });

  it('throws 404 for not found', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(null);
    await expect(service.getBySlug('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('CompetitionService.update', () => {
  it('updates as owner', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1' }));
    mockPrisma.competition.update.mockResolvedValue(createMockCompetition({ prize: '$500' }));
    mockPrisma.competition.findFirst.mockResolvedValue(null);

    const result = await service.update('comp-1', 'host-1', { prize: '$500' });
    expect(result.prize).toBe('$500');
  });

  it('rejects non-owner', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1' }));
    await expect(service.update('comp-1', 'other', { prize: '$500' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows admin to update', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1' }));
    mockPrisma.competition.update.mockResolvedValue(createMockCompetition());

    await service.update('comp-1', 'admin', { prize: '$500' }, true);
    expect(mockPrisma.competition.update).toHaveBeenCalled();
  });
});

describe('CompetitionService.updateStatus', () => {
  const transitions: [CompetitionStatus, CompetitionStatus][] = [
    ['DRAFT', 'PENDING_REVIEW'],
    ['ACTIVE', 'COMPLETED'],
    ['COMPLETED', 'ARCHIVED'],
  ];

  it.each(transitions)('allows %s -> %s', async (from, to) => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: from, hostId: 'host-1' }));
    mockPrisma.competition.update.mockResolvedValue(createMockCompetition({ status: to }));

    const result = await service.updateStatus('comp-1', to, 'host-1', to === 'ACTIVE' || to === 'DRAFT');
    expect(mockPrisma.competition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: to } })
    );
  });

  it('rejects invalid transition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'DRAFT' }));
    await expect(service.updateStatus('comp-1', 'COMPLETED' as any, 'host-1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('only admin can approve (PENDING_REVIEW -> ACTIVE)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'PENDING_REVIEW' }));
    await expect(service.updateStatus('comp-1', 'ACTIVE' as any, 'host-1', false))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('CompetitionService.delete', () => {
  it('deletes as owner', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1', status: 'DRAFT' }));
    mockPrisma.competition.delete.mockResolvedValue(createMockCompetition());

    await service.delete('comp-1', 'host-1');
    expect(mockPrisma.competition.delete).toHaveBeenCalled();
  });

  it('rejects non-owner', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1' }));
    await expect(service.delete('comp-1', 'other'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects deleting ACTIVE competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ hostId: 'host-1', status: 'ACTIVE' }));
    await expect(service.delete('comp-1', 'host-1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
