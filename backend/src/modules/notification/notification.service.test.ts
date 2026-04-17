import { mockPrismaClient } from '../../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { NotificationService } from './notification.service';

const service = new NotificationService();
beforeEach(() => jest.clearAllMocks());

describe('NotificationService.create', () => {
  it('creates a notification', async () => {
    mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
    const result = await service.create('user-1', 'SUBMISSION_SCORED', 'Scored', 'Your score: 0.95');
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'SUBMISSION_SCORED',
          title: 'Scored',
        }),
      })
    );
  });
});

describe('NotificationService.createBulk', () => {
  it('creates notifications for multiple users', async () => {
    mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });
    await service.createBulk(['u1', 'u2', 'u3'], 'SYSTEM', 'Title', 'Message');
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'u1' }),
          expect.objectContaining({ userId: 'u2' }),
          expect.objectContaining({ userId: 'u3' }),
        ]),
      })
    );
  });
});

describe('NotificationService.getUserNotifications', () => {
  it('returns paginated notifications with unread count', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1', isRead: false }]);
    mockPrisma.notification.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    const result = await service.getUserNotifications('user-1');
    expect(result.data).toHaveLength(1);
    expect(result.unreadCount).toBe(3);
    expect(result.pagination.total).toBe(10);
  });
});

describe('NotificationService.markAsRead', () => {
  it('marks single notification as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markAsRead('user-1', 'n1');
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1', userId: 'user-1' },
        data: { isRead: true },
      })
    );
  });
});

describe('NotificationService.markAllAsRead', () => {
  it('marks all unread as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });
    await service.markAllAsRead('user-1');
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', isRead: false },
      })
    );
  });
});
