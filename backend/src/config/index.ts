import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] || fallback;
  if (!val && isProd) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val || fallback || '';
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET', isProd ? undefined : 'dev-access-secret'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', isProd ? undefined : 'dev-refresh-secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/v1/auth'}/google/callback`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/v1/auth'}/github/callback`,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: requireEnv('MINIO_ACCESS_KEY', isProd ? undefined : 'minioadmin'),
    secretKey: requireEnv('MINIO_SECRET_KEY', isProd ? undefined : 'minioadmin'),
    bucket: process.env.MINIO_BUCKET || 'competition-platform',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    region: process.env.MINIO_REGION || 'us-east-1',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@competition-platform.com',
  },

  auth: {
    bcryptRounds: 12,
    maxFailedLogins: 5,
    lockDurationMinutes: 15,
    resetTokenExpiryHours: 1,
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
} as const;

if (isProd) {
  if (config.jwt.accessSecret.includes('change-in-production') || config.jwt.accessSecret.length < 32) {
    throw new Error('FATAL: JWT_ACCESS_SECRET must be a strong random secret in production (>= 32 chars)');
  }
  if (config.jwt.refreshSecret.includes('change-in-production') || config.jwt.refreshSecret.length < 32) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be a strong random secret in production (>= 32 chars)');
  }
  if (config.minio.accessKey === 'minioadmin') {
    throw new Error('FATAL: MINIO_ACCESS_KEY must not use default credentials in production');
  }
}
