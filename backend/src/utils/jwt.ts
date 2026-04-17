import jwt from 'jsonwebtoken';
import { config } from '../config';

interface TokenPayload {
  userId: string;
  role: string;
}

const JWT_OPTIONS = {
  algorithm: 'HS256' as const,
  issuer: 'competition-platform',
  audience: 'competition-platform-api',
};

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    ...JWT_OPTIONS,
    expiresIn: config.jwt.accessExpiresIn,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    ...JWT_OPTIONS,
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.accessSecret, {
    algorithms: ['HS256'],
    issuer: 'competition-platform',
    audience: 'competition-platform-api',
  }) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret, {
    algorithms: ['HS256'],
    issuer: 'competition-platform',
    audience: 'competition-platform-api',
  }) as TokenPayload;
}
