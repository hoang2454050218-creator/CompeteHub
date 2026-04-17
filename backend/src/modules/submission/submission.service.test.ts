import { createMockCompetition, createMockEnrollment, createMockSubmission, mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../services/storage.service', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    uploadStream: jest.fn().mockResolvedValue('submissions/file.csv'),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../config/redis', () => ({
  createRedisConnection: jest.fn().mockReturnValue({
    on: jest.fn(), connect: jest.fn(), disconnect: jest.fn(),
  }),
}));
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  })),
}));

jest.mock('../../utils/fileHelpers', () => ({
  sanitizeFilename: jest.fn().mockReturnValue('uuid_submission.csv'),
  validateCsvMagicBytes: jest.fn().mockReturnValue(true),
  computeFileHash: jest.fn().mockResolvedValue('abc123hash'),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
    unlink: jest.fn((_path: string, cb?: Function) => cb && cb(null)),
  };
});

import { SubmissionService } from './submission.service';

const service = new SubmissionService();
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any, _opts?: any) => {
    if (typeof fn === 'function') return fn(mockPrisma);
    return Promise.all(fn);
  });
});

const mockFile = {
  originalname: 'submission.csv',
  path: '/tmp/upload_123',
  buffer: Buffer.from('id,target\n1,0\n2,1'),
  size: 100,
  mimetype: 'text/csv',
} as Express.Multer.File;

describe('SubmissionService.submit', () => {
  it('creates submission and enqueues scoring job', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment());
    mockPrisma.submission.findFirst.mockResolvedValue(null);
    mockPrisma.submission.count.mockResolvedValue(0);
    mockPrisma.submission.create.mockResolvedValue(createMockSubmission());

    const result = await service.submit('user-1', 'comp-1', mockFile);
    expect(result.status).toBe('QUEUED');
    expect(mockPrisma.submission.create).toHaveBeenCalled();
  });

  it('rejects when competition is not ACTIVE', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'COMPLETED' }));
    await expect(service.submit('user-1', 'comp-1', mockFile))
      .rejects.toMatchObject({ errorCode: 'COMPETITION_ENDED' });
  });

  it('rejects when not enrolled', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await expect(service.submit('user-1', 'comp-1', mockFile))
      .rejects.toMatchObject({ errorCode: 'NOT_ENROLLED' });
  });

  it('rejects when daily limit exceeded', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE', maxDailySubs: 3 }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment());
    mockPrisma.submission.findFirst.mockResolvedValue(null);
    mockPrisma.submission.count.mockResolvedValue(3);

    await expect(service.submit('user-1', 'comp-1', mockFile))
      .rejects.toMatchObject({ statusCode: 429, errorCode: 'DAILY_LIMIT_EXCEEDED' });
  });

  it('rejects when file too large', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE', maxFileSize: 50 }));
    await expect(service.submit('user-1', 'comp-1', { ...mockFile, size: 100 } as any))
      .rejects.toMatchObject({ statusCode: 413 });
  });

  it('rejects when total limit exceeded', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE', maxTotalSubs: 10 }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment());
    mockPrisma.submission.findFirst.mockResolvedValue(null);
    mockPrisma.submission.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10);

    await expect(service.submit('user-1', 'comp-1', mockFile))
      .rejects.toMatchObject({ statusCode: 429 });
  });

  it('rejects duplicate file submission', async () => {
    mockPrisma.competition.findUnique.mockResolvedValue(createMockCompetition({ status: 'ACTIVE' }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(createMockEnrollment());
    mockPrisma.submission.findFirst.mockResolvedValue(createMockSubmission());

    await expect(service.submit('user-1', 'comp-1', mockFile))
      .rejects.toMatchObject({ statusCode: 409, errorCode: 'DUPLICATE_SUBMISSION' });
  });
});

describe('SubmissionService.listUserSubmissions', () => {
  it('returns paginated submissions', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([createMockSubmission()]);
    mockPrisma.submission.count.mockResolvedValue(1);

    const result = await service.listUserSubmissions('user-1', 'comp-1');
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('caps limit at 100', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([]);
    mockPrisma.submission.count.mockResolvedValue(0);

    const result = await service.listUserSubmissions('user-1', 'comp-1', 1, 999);
    expect(result.pagination.limit).toBe(100);
  });
});

describe('SubmissionService.selectSubmission', () => {
  it('selects a scored submission', async () => {
    mockPrisma.submission.findUnique.mockResolvedValue(createMockSubmission({ status: 'SCORED', userId: 'user-1' }));
    mockPrisma.submission.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.submission.update.mockResolvedValue(createMockSubmission({ isSelected: true }));

    const result = await service.selectSubmission('user-1', 'sub-1');
    expect(mockPrisma.submission.updateMany).toHaveBeenCalled();
  });

  it('rejects if not owner', async () => {
    mockPrisma.submission.findUnique.mockResolvedValue(createMockSubmission({ userId: 'other' }));
    await expect(service.selectSubmission('user-1', 'sub-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects if not scored', async () => {
    mockPrisma.submission.findUnique.mockResolvedValue(createMockSubmission({ status: 'QUEUED', userId: 'user-1' }));
    await expect(service.selectSubmission('user-1', 'sub-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
