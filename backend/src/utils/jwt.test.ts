import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';

describe('JWT Utilities', () => {
  const payload = { userId: 'user-123', role: 'PARTICIPANT' };

  describe('generateAccessToken', () => {
    it('returns a string token', () => {
      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('generates different tokens for different payloads', () => {
      const t1 = generateAccessToken({ userId: 'a', role: 'ADMIN' });
      const t2 = generateAccessToken({ userId: 'b', role: 'HOST' });
      expect(t1).not.toBe(t2);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a string token', () => {
      const token = generateRefreshToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('generates different token than access token', () => {
      const access = generateAccessToken(payload);
      const refresh = generateRefreshToken(payload);
      expect(access).not.toBe(refresh);
    });
  });

  describe('verifyAccessToken', () => {
    it('decodes a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('PARTICIPANT');
    });

    it('throws for an invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('throws for a refresh token used as access', () => {
      const refresh = generateRefreshToken(payload);
      expect(() => verifyAccessToken(refresh)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('decodes a valid refresh token', () => {
      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('PARTICIPANT');
    });

    it('throws for an invalid token', () => {
      expect(() => verifyRefreshToken('garbage')).toThrow();
    });

    it('throws for an access token used as refresh', () => {
      const access = generateAccessToken(payload);
      expect(() => verifyRefreshToken(access)).toThrow();
    });
  });
});
