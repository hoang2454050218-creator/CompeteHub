import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, exchangeCodeSchema } from './auth.validator';

const VALID_PASSWORD = 'Password1';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: VALID_PASSWORD,
      name: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: VALID_PASSWORD,
      name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Ab1',
      name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password1',
      name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password',
      name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short name', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: VALID_PASSWORD,
      name: 'J',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'any',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid input', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: VALID_PASSWORD }).success).toBe(true);
  });

  it('rejects short password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'Ab1' }).success).toBe(false);
  });
});

describe('exchangeCodeSchema', () => {
  it('accepts valid code', () => {
    expect(exchangeCodeSchema.safeParse({ code: 'abc123' }).success).toBe(true);
  });

  it('rejects empty code', () => {
    expect(exchangeCodeSchema.safeParse({ code: '' }).success).toBe(false);
  });

  it('rejects missing code', () => {
    expect(exchangeCodeSchema.safeParse({}).success).toBe(false);
  });
});
