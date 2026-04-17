import { Prisma } from '@prisma/client';
import { createMockCompetition, createMockEnrollment, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { EnrollmentService } from './enrollment.service';

const service = new EnrollmentService();
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') return fn(mockPrisma);
    return Promise.all(fn);
  });
});

describe('EnrollmentService.enroll', () => {
  it('enrolls user in active competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    mockPrisma.enrollment.create.mockResolvedValue(createMockEnrollment());

    const result = await service.enroll('user-1', 'comp-1');
    expect(result).toBeDefined();
    expect(mockPrisma.enrollment.create).toHaveBeenCalled();
  });

  it('rejects enrollment in non-ACTIVE competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'DRAFT' }));
    await expect(service.enroll('user-1', 'comp-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects duplicate enrollment (P2002)', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    mockPrisma.enrollment.create.mockRejectedValue(p2002);
    await expect(service.enroll('user-1', 'comp-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 404 for non-existent competition', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(null);
    await expect(service.enroll('user-1', 'no-comp')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('EnrollmentService.unenroll', () => {
  it('removes enrollment without team', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment({ teamId: null, team: null }));
    mockPrisma.enrollment.delete.mockResolvedValue(createMockEnrollment());
    await service.unenroll('user-1', 'comp-1');
    expect(mockPrisma.enrollment.delete).toHaveBeenCalled();
  });

  it('throws 404 when not enrolled', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await expect(service.unenroll('user-1', 'comp-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('EnrollmentService.isEnrolled', () => {
  it('returns true when enrolled', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment());
    expect(await service.isEnrolled('user-1', 'comp-1')).toBe(true);
  });

  it('returns false when not enrolled', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    expect(await service.isEnrolled('user-1', 'comp-1')).toBe(false);
  });
});

describe('EnrollmentService.getParticipants', () => {
  it('returns paginated participants', async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([createMockEnrollment()]);
    mockPrisma.enrollment.count.mockResolvedValue(1);

    const result = await service.getParticipants('comp-1');
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });
});
