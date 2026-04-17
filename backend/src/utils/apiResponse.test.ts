import { sendSuccess, sendError, AppError } from './apiResponse';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.body = data; return this; },
  };
  return res;
}

describe('sendSuccess', () => {
  it('sends 200 with standard format', () => {
    const res = createMockRes();
    sendSuccess(res, { id: 1 }, 'OK');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { id: 1 },
      message: 'OK',
    });
  });

  it('sends custom status code', () => {
    const res = createMockRes();
    sendSuccess(res, null, 'Created', 201);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('includes pagination when provided', () => {
    const res = createMockRes();
    const pagination = { page: 1, limit: 10, total: 50, totalPages: 5 };
    sendSuccess(res, [], 'OK', 200, pagination);
    expect(res.body.pagination).toEqual(pagination);
  });

  it('uses default message', () => {
    const res = createMockRes();
    sendSuccess(res, 'data');
    expect(res.body.message).toBe('Thành công');
  });
});

describe('sendError', () => {
  it('sends error with standard format', () => {
    const res = createMockRes();
    sendError(res, 'Not found', 404, 'NOT_FOUND');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      data: null,
      message: 'Not found',
      errorCode: 'NOT_FOUND',
    });
  });

  it('defaults to 400', () => {
    const res = createMockRes();
    sendError(res, 'Bad request');
    expect(res.statusCode).toBe(400);
  });
});

describe('AppError', () => {
  it('creates error with message and status code', () => {
    const err = new AppError('Something broke', 500, 'INTERNAL');
    expect(err.message).toBe('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.errorCode).toBe('INTERNAL');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });

  it('defaults to 400', () => {
    const err = new AppError('Bad');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBeUndefined();
  });
});
