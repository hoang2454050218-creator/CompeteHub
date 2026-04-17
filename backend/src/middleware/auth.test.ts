import { mockPrismaClient } from '../tests/helpers';

const mockPrisma = mockPrismaClient();
jest.mock('../config/database', () => ({ __esModule: true, default: mockPrisma }));

import { authenticate, authorize, optionalAuth } from './auth';
import { generateAccessToken } from '../utils/jwt';

beforeEach(() => jest.clearAllMocks());

describe('authenticate middleware', () => {
  function createMocks(authHeader?: string) {
    const req: any = { headers: { authorization: authHeader }, user: undefined };
    const res = {} as any;
    const next = jest.fn();
    return { req, res, next };
  }

  it('sets req.user for valid token', async () => {
    const token = generateAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const { req, res, next } = createMocks(`Bearer ${token}`);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARTICIPANT', isActive: true, email: 'u1@test.com', name: 'User 1',
    });
    await authenticate(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('u1');
    expect(req.user.role).toBe('PARTICIPANT');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(error) without auth header', async () => {
    const { req, res, next } = createMocks();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(error) for invalid token', async () => {
    const { req, res, next } = createMocks('Bearer invalid.token');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(error) for deactivated user', async () => {
    const token = generateAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const { req, res, next } = createMocks(`Bearer ${token}`);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARTICIPANT', isActive: false, email: 'u1@test.com', name: 'User 1',
    });
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(error) for user not found', async () => {
    const token = generateAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const { req, res, next } = createMocks(`Bearer ${token}`);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('authorize middleware', () => {
  it('allows user with matching role', () => {
    const req: any = { user: { userId: 'u1', role: 'ADMIN' } };
    const next = jest.fn();
    authorize('ADMIN', 'HOST')(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects user with non-matching role', () => {
    const req: any = { user: { userId: 'u1', role: 'PARTICIPANT' } };
    const next = jest.fn();
    authorize('ADMIN', 'HOST')(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects when no user present', () => {
    const req: any = { user: undefined };
    const next = jest.fn();
    authorize('ADMIN')(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('optionalAuth middleware', () => {
  it('sets req.user for valid token', async () => {
    const token = generateAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const req: any = { headers: { authorization: `Bearer ${token}` }, user: undefined };
    const next = jest.fn();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARTICIPANT', isActive: true, email: 'u1@test.com', name: 'User 1',
    });
    await optionalAuth(req, {} as any, next);
    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('continues without user when no token', async () => {
    const req: any = { headers: {}, user: undefined };
    const next = jest.fn();
    await optionalAuth(req, {} as any, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('continues without user when token is invalid', async () => {
    const req: any = { headers: { authorization: 'Bearer garbage' }, user: undefined };
    const next = jest.fn();
    await optionalAuth(req, {} as any, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
