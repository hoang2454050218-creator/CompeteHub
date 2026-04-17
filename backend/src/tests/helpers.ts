import { Role, CompetitionStatus, EvalMetric, CompetitionCategory, SubmissionStatus } from '@prisma/client';
import { generateAccessToken } from '../utils/jwt';

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$2a$12$hashedpassword',
    name: 'Test User',
    avatarUrl: null,
    bio: null,
    githubId: null,
    googleId: null,
    githubUrl: null,
    linkedinUrl: null,
    role: Role.PARTICIPANT,
    isActive: true,
    failedLogins: 0,
    lockedUntil: null,
    resetToken: null,
    resetTokenExp: null,
    refreshToken: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockCompetition(overrides: Record<string, any> = {}) {
  return {
    id: 'comp-1',
    hostId: 'host-1',
    title: 'Test Competition',
    slug: 'test-competition',
    description: 'A test competition',
    rules: 'No rules',
    coverImage: null,
    status: CompetitionStatus.ACTIVE,
    category: CompetitionCategory.COMMUNITY,
    tags: ['test'],
    prize: '$100',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    evalMetric: EvalMetric.ACCURACY,
    customScript: null,
    pubPrivSplit: 0.3,
    maxTeamSize: 4,
    maxDailySubs: 5,
    maxTotalSubs: null,
    maxFileSize: 104857600,
    mergeDeadline: null,
    sampleFileUrl: null,
    groundTruthUrl: 'ground-truth/comp-1/truth.csv',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockSubmission(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    competitionId: 'comp-1',
    teamId: null,
    fileUrl: 'submissions/comp-1/user-1/file.csv',
    fileName: 'submission.csv',
    description: 'Test submission',
    status: SubmissionStatus.QUEUED,
    publicScore: null,
    privateScore: null,
    errorMessage: null,
    isSelected: false,
    scoredAt: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockEnrollment(overrides: Record<string, any> = {}) {
  return {
    id: 'enroll-1',
    userId: 'user-1',
    competitionId: 'comp-1',
    teamId: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function generateTestToken(userId = 'user-1', role: string = 'PARTICIPANT') {
  return generateAccessToken({ userId, role });
}

export function mockPrismaClient() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    competition: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    enrollment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    submission: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    leaderboardEntry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    discussion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    discussionReply: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    vote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    teamInvitation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    dataset: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
}
