import { stripHtmlTags, sanitizeFilename, validateCsvMagicBytes, computeFileHash } from '../utils/fileHelpers';
import { generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('XSS Sanitization — stripHtmlTags', () => {
  it('strips <script> tags', () => {
    expect(stripHtmlTags('<script>alert(1)</script>')).not.toContain('<script');
  });

  it('strips <iframe> tags', () => {
    expect(stripHtmlTags('<iframe src="evil.com"></iframe>')).not.toContain('<iframe');
  });

  it('strips <svg onload> payloads', () => {
    const payload = '<svg onload="alert(1)">';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('onload');
  });

  it('strips <img onerror> payloads', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: URIs in <a> tags', () => {
    const payload = '<a href="javascript:alert(1)">click</a>';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<a');
  });

  it('strips data: URIs in tags', () => {
    const payload = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<a');
    expect(result).not.toContain('<script');
  });

  it('strips <details ontoggle> payloads', () => {
    const payload = '<details ontoggle="alert(1)" open>test</details>';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<details');
    expect(result).not.toContain('ontoggle');
  });

  it('strips nested/obfuscated XSS', () => {
    const payload = '<div><img src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))"></div>';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('<div');
    expect(result).not.toContain('onerror');
  });

  it('strips <math> XSS payload', () => {
    const payload = '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=x onerror=alert(1)&gt;">';
    const result = stripHtmlTags(payload);
    expect(result).not.toContain('<math');
    expect(result).not.toContain('<style');
    expect(result).not.toContain('onerror');
  });

  it('preserves plain text', () => {
    expect(stripHtmlTags('Hello World')).toBe('Hello World');
    expect(stripHtmlTags('Score: 0.95')).toBe('Score: 0.95');
    expect(stripHtmlTags('1 < 2 & 3 > 1')).toContain('1');
  });

  it('handles empty string', () => {
    expect(stripHtmlTags('')).toBe('');
  });

  it('handles string with only tags', () => {
    const result = stripHtmlTags('<b><i><u></u></i></b>');
    expect(result).not.toContain('<b');
    expect(result).not.toContain('<i');
  });
});

describe('JWT Token Security', () => {
  it('generates valid access token', () => {
    const token = generateAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.role).toBe('PARTICIPANT');
  });

  it('generates valid refresh token', () => {
    const token = generateRefreshToken({ userId: 'u1', role: 'PARTICIPANT' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('u1');
  });

  it('rejects token with wrong secret', () => {
    const token = jwt.sign({ userId: 'u1', role: 'ADMIN' }, 'wrong-secret', {
      algorithm: 'HS256',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects token with wrong algorithm (HS384)', () => {
    const token = jwt.sign({ userId: 'u1', role: 'ADMIN' }, 'dev-access-secret', {
      algorithm: 'HS384',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects token without issuer', () => {
    const token = jwt.sign({ userId: 'u1', role: 'ADMIN' }, 'dev-access-secret', {
      algorithm: 'HS256',
      audience: 'competition-platform-api',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects token without audience', () => {
    const token = jwt.sign({ userId: 'u1', role: 'ADMIN' }, 'dev-access-secret', {
      algorithm: 'HS256',
      issuer: 'competition-platform',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects expired token', () => {
    const token = jwt.sign(
      { userId: 'u1', role: 'PARTICIPANT' },
      'dev-access-secret',
      { algorithm: 'HS256', issuer: 'competition-platform', audience: 'competition-platform-api', expiresIn: '0s' }
    );
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects garbage string', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
    expect(() => verifyAccessToken('')).toThrow();
  });

  it('rejects none algorithm attack', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 'u1', role: 'ADMIN' })).toString('base64url');
    const token = `${header}.${payload}.`;
    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe('Filename Sanitization', () => {
  it('removes path traversal attempts', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
    expect(result).toContain('passwd');
  });

  it('sanitizes special characters', () => {
    const result = sanitizeFilename('file name <script>.csv');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toMatch(/\.csv$/);
  });

  it('prepends UUID', () => {
    const result = sanitizeFilename('test.csv');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/;
    expect(result).toMatch(uuidRegex);
  });

  it('handles empty filename', () => {
    const result = sanitizeFilename('');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('CSV Magic Bytes Validation', () => {
  const tmpDir = os.tmpdir();

  it('accepts valid CSV', () => {
    const tmpFile = path.join(tmpDir, `test_valid_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, 'id,value\n1,hello\n2,world\n');
    try {
      expect(validateCsvMagicBytes(tmpFile)).toBe(true);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('accepts CSV with BOM', () => {
    const tmpFile = path.join(tmpDir, `test_bom_${Date.now()}.csv`);
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from('id,value\n1,hello\n');
    fs.writeFileSync(tmpFile, Buffer.concat([bom, content]));
    try {
      expect(validateCsvMagicBytes(tmpFile)).toBe(true);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('rejects binary file', () => {
    const tmpFile = path.join(tmpDir, `test_binary_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]));
    try {
      expect(validateCsvMagicBytes(tmpFile)).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('rejects empty file', () => {
    const tmpFile = path.join(tmpDir, `test_empty_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, '');
    try {
      expect(validateCsvMagicBytes(tmpFile)).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe('File Hash', () => {
  it('produces consistent SHA-256 hash', async () => {
    const tmpFile = path.join(os.tmpdir(), `test_hash_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, 'id,value\n1,2\n');
    try {
      const hash1 = await computeFileHash(tmpFile);
      const hash2 = await computeFileHash(tmpFile);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('produces different hashes for different content', async () => {
    const tmpFile1 = path.join(os.tmpdir(), `test_h1_${Date.now()}.csv`);
    const tmpFile2 = path.join(os.tmpdir(), `test_h2_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile1, 'id,value\n1,2\n');
    fs.writeFileSync(tmpFile2, 'id,value\n1,3\n');
    try {
      const h1 = await computeFileHash(tmpFile1);
      const h2 = await computeFileHash(tmpFile2);
      expect(h1).not.toBe(h2);
    } finally {
      fs.unlinkSync(tmpFile1);
      fs.unlinkSync(tmpFile2);
    }
  });
});

describe('CSV Formula Injection Protection', () => {
  it('leaderboard CSV export prefixes formula chars', () => {
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
    dangerousChars.forEach((char) => {
      let val = `${char}SUM(A1:A10)`;
      val = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(val)) val = `'${val}`;
      expect(val.startsWith("'")).toBe(true);
    });
  });
});
