import { validate } from './validate';
import { z } from 'zod';

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive(),
  });

  function createMocks(body: any = {}) {
    const req = { body, query: {}, params: {} } as any;
    const res = {} as any;
    const next = jest.fn();
    return { req, res, next };
  }

  it('calls next() for valid body', () => {
    const { req, res, next } = createMocks({ name: 'John', age: 25 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'John', age: 25 });
  });

  it('calls next(error) for invalid body', () => {
    const { req, res, next } = createMocks({ name: 'J', age: -1 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('validates query params when source is query', () => {
    const querySchema = z.object({ page: z.coerce.number().default(1) });
    const req = { body: {}, query: { page: '3' }, params: {} } as any;
    const next = jest.fn();
    validate(querySchema, 'query')(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query.page).toBe(3);
  });
});
