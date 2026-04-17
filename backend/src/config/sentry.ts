import * as Sentry from '@sentry/node';
import { config } from './index';

export function initSentry() {
  if (!config.sentry.dsn) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    release: process.env.npm_package_version || 'unknown',
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        for (const key of ['password', 'token', 'refreshToken', 'accessToken', 'secret']) {
          if (key in data) data[key] = '[REDACTED]';
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

export { Sentry };
