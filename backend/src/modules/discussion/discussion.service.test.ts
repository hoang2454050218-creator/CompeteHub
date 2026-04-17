import { mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { DiscussionService } from './discussion.service';

const service = new DiscussionService();
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fnOrArray: any, _opts?: any) => {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(mockPrisma);
    }
    return Promise.all(fnOrArray);
  });
});

describe('DiscussionService.createTopic', () => {
  it('creates a topic', async () => {
    mockPrisma.discussion.create.mockResolvedValue({ id: 'd1', title: 'Help' });
    const result = await service.createTopic('comp-1', 'user-1', 'Help', 'Need help with X');
    expect(mockPrisma.discussion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          competitionId: 'comp-1',
          authorId: 'user-1',
          title: 'Help',
          content: 'Need help with X',
        }),
      })
    );
  });
});

describe('DiscussionService.listTopics', () => {
  it('returns paginated topics with pinned first', async () => {
    mockPrisma.discussion.findMany.mockResolvedValue([]);
    mockPrisma.discussion.count.mockResolvedValue(0);

    const result = await service.listTopics('comp-1');
    expect(mockPrisma.discussion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      })
    );
  });
});

describe('DiscussionService.createReply', () => {
  it('creates top-level reply', async () => {
    mockPrisma.discussion.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.discussionReply.create.mockResolvedValue({ id: 'r1' });
    mockPrisma.discussion.update.mockResolvedValue({});

    await service.createReply('d1', 'user-1', 'My reply');
    expect(mockPrisma.discussionReply.create).toHaveBeenCalled();
    expect(mockPrisma.discussion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { replyCount: { increment: 1 } },
      })
    );
  });

  it('creates nested reply', async () => {
    mockPrisma.discussion.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.discussionReply.findUnique.mockResolvedValue({ id: 'r1', parentReplyId: null });
    mockPrisma.discussionReply.create.mockResolvedValue({ id: 'r2' });
    mockPrisma.discussion.update.mockResolvedValue({});

    await service.createReply('d1', 'user-1', 'Nested', 'r1');
    expect(mockPrisma.discussionReply.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentReplyId: 'r1' }),
      })
    );
  });

  it('rejects nesting beyond 2 levels', async () => {
    mockPrisma.discussion.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.discussionReply.findUnique.mockResolvedValue({ id: 'r1', parentReplyId: 'r0' });

    await expect(service.createReply('d1', 'user-1', 'Too deep', 'r1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for non-existent discussion', async () => {
    mockPrisma.discussion.findUnique.mockResolvedValue(null);
    await expect(service.createReply('nope', 'user-1', 'Reply'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DiscussionService.vote', () => {
  it('creates new vote', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({ id: 'd1', competitionId: 'comp-1' });
    mockPrisma.vote.findUnique.mockResolvedValue(null);
    mockPrisma.vote.create.mockResolvedValue({});
    mockPrisma.discussion.update.mockResolvedValue({});

    const result = await service.vote('user-1', 'comp-1', 'DISCUSSION', 'd1', 1);
    expect(result.action).toBe('voted');
  });

  it('removes existing same-value vote', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({ id: 'd1', competitionId: 'comp-1' });
    mockPrisma.vote.findUnique.mockResolvedValue({ id: 'v1', value: 1 });
    mockPrisma.vote.delete.mockResolvedValue({});
    mockPrisma.discussion.update.mockResolvedValue({});

    const result = await service.vote('user-1', 'comp-1', 'DISCUSSION', 'd1', 1);
    expect(result.action).toBe('removed');
  });

  it('changes vote direction', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({ id: 'd1', competitionId: 'comp-1' });
    mockPrisma.vote.findUnique.mockResolvedValue({ id: 'v1', value: 1 });
    mockPrisma.vote.update.mockResolvedValue({});
    mockPrisma.discussion.update.mockResolvedValue({});

    const result = await service.vote('user-1', 'comp-1', 'DISCUSSION', 'd1', -1);
    expect(result.action).toBe('changed');
  });

  it('rejects vote on discussion from different competition (IDOR)', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue(null);

    await expect(service.vote('user-1', 'comp-1', 'DISCUSSION', 'foreign-d1', 1))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects vote on reply from different competition (IDOR)', async () => {
    mockPrisma.discussionReply.findFirst.mockResolvedValue(null);

    await expect(service.vote('user-1', 'comp-1', 'REPLY', 'foreign-r1', 1))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DiscussionService.pinTopic', () => {
  it('pins a topic when admin', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({
      id: 'd1',
      competitionId: 'comp-1',
      competition: { hostId: 'host-1' },
    });
    mockPrisma.discussion.update.mockResolvedValue({ isPinned: true });
    await service.pinTopic('comp-1', 'd1', true, 'someone-else', true);
    expect(mockPrisma.discussion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPinned: true } })
    );
  });

  it('pins a topic when host (owner)', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({
      id: 'd1',
      competitionId: 'comp-1',
      competition: { hostId: 'host-1' },
    });
    mockPrisma.discussion.update.mockResolvedValue({ isPinned: true });
    await service.pinTopic('comp-1', 'd1', true, 'host-1', false);
    expect(mockPrisma.discussion.update).toHaveBeenCalled();
  });

  it('rejects pin when neither host nor admin', async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({
      id: 'd1',
      competitionId: 'comp-1',
      competition: { hostId: 'host-1' },
    });
    await expect(service.pinTopic('comp-1', 'd1', true, 'random-user', false))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
