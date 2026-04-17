import { errorHandler } from './errorHandler';
import { AppError } from '../utils/apiResponse';
import { ZodError, ZodIssue } from 'zod';

function createMockReqRes() {
  const req = {} as any;
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('errorHandler', () => {
  it('handles AppError with correct status and errorCode', () => {
    const { req, res, next } = createMockReqRes();
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Not found');
    expect(res.body.errorCode).toBe('NOT_FOUND');
  });

  it('handles ZodError with 400 and formatted message', () => {
    const { req, res, next } = createMockReqRes();
    const issues: ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['email'], message: 'Expected string' },
    ];
    const err = new ZodError(issues);
    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('email');
  });

  it('handles generic Error with 500', () => {
    const { req, res, next } = createMockReqRes();
    const err = new Error('Something went wrong');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.errorCode).toBe('INTERNAL_ERROR');
    consoleSpy.mockRestore();
  });
});
