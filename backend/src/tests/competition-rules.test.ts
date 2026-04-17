import { mockPrismaClient, createMockCompetition } from './helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { CompetitionService } from '../modules/competition/competition.service';

const service = new CompetitionService();
beforeEach(() => jest.clearAllMocks());

describe('Competition Fairness — Update Immutability', () => {
  it('blocks evalMetric change on ACTIVE competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE', evalMetric: 'ACCURACY' })
    );

    await expect(
      service.update('comp-1', 'host-1', { evalMetric: 'RMSE' })
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'IMMUTABLE_FIELD' });
  });

  it('blocks pubPrivSplit change on ACTIVE competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE', pubPrivSplit: 0.3 })
    );

    await expect(
      service.update('comp-1', 'host-1', { pubPrivSplit: 0.5 })
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'IMMUTABLE_FIELD' });
  });

  it('blocks maxTeamSize change on ACTIVE competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE', maxTeamSize: 4 })
    );

    await expect(
      service.update('comp-1', 'host-1', { maxTeamSize: 8 })
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'IMMUTABLE_FIELD' });
  });

  it('allows description change on ACTIVE competition', async () => {
    const comp = createMockCompetition({ status: 'ACTIVE' });
    mockPrisma.competition.findUnique.mockResolvedValue(comp);
    mockPrisma.competition.update.mockResolvedValue({ ...comp, description: 'new desc' });

    const result = await service.update('comp-1', 'host-1', { description: 'new desc' });
    expect(mockPrisma.competition.update).toHaveBeenCalled();
  });

  it('allows evalMetric change on DRAFT competition', async () => {
    const comp = createMockCompetition({ status: 'DRAFT' });
    mockPrisma.competition.findUnique.mockResolvedValue(comp);
    mockPrisma.competition.update.mockResolvedValue({ ...comp, evalMetric: 'RMSE' });

    await service.update('comp-1', 'host-1', { evalMetric: 'RMSE' });
    expect(mockPrisma.competition.update).toHaveBeenCalled();
  });
});

describe('Competition Status Transitions', () => {
  it('allows DRAFT → PENDING_REVIEW', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'DRAFT' })
    );
    mockPrisma.competition.update.mockResolvedValue(
      createMockCompetition({ status: 'PENDING_REVIEW' })
    );

    await service.updateStatus('comp-1', 'PENDING_REVIEW', 'host-1');
    expect(mockPrisma.competition.update).toHaveBeenCalled();
  });

  it('blocks DRAFT → ACTIVE (must go through review)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'DRAFT' })
    );

    await expect(
      service.updateStatus('comp-1', 'ACTIVE', 'host-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks ACTIVE → DRAFT (no going back)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE' })
    );

    await expect(
      service.updateStatus('comp-1', 'DRAFT', 'host-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks ARCHIVED → anything', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ARCHIVED' })
    );

    await expect(
      service.updateStatus('comp-1', 'ACTIVE', 'host-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks non-host from updating status', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'DRAFT', hostId: 'host-1' })
    );

    await expect(
      service.updateStatus('comp-1', 'PENDING_REVIEW', 'other-user')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks non-admin from approving (PENDING_REVIEW → ACTIVE)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'PENDING_REVIEW' })
    );

    await expect(
      service.updateStatus('comp-1', 'ACTIVE', 'host-1', false)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('Competition Ownership', () => {
  it('blocks update by non-host non-admin', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ hostId: 'host-1' })
    );

    await expect(
      service.update('comp-1', 'attacker-1', { description: 'hacked' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows update by admin', async () => {
    const comp = createMockCompetition({ hostId: 'host-1' });
    mockPrisma.competition.findUnique.mockResolvedValue(comp);
    mockPrisma.competition.update.mockResolvedValue(comp);

    await service.update('comp-1', 'admin-1', { description: 'admin update' }, true);
    expect(mockPrisma.competition.update).toHaveBeenCalled();
  });

  it('blocks delete of active competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE', hostId: 'host-1' })
    );

    await expect(
      service.delete('comp-1', 'host-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Private Leaderboard Access Control', () => {
  const { LeaderboardService } = require('../modules/leaderboard/leaderboard.service');
  const leaderboardService = new LeaderboardService();

  it('blocks private leaderboard when competition is ACTIVE', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE' })
    );

    await expect(
      leaderboardService.getPrivateLeaderboard('comp-1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks shakeup when competition is ACTIVE', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'ACTIVE' })
    );

    await expect(
      leaderboardService.getShakeup('comp-1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows private leaderboard when COMPLETED', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(
      createMockCompetition({ status: 'COMPLETED', evalMetric: 'ACCURACY' })
    );
    mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
    mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

    const result = await leaderboardService.getPrivateLeaderboard('comp-1');
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });
});
