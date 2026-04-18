import { Router } from 'express';
import passport from 'passport';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, exchangeCodeSchema, verifyEmailSchema, resendVerificationSchema, mfaLoginSchema, mfaEnableSchema, mfaDisableSchema } from './auth.validator';
import { generateOAuthState, validateOAuthState } from '../../utils/oauthState';
import { sendSuccess, AppError } from '../../utils/apiResponse';
import { config } from '../../config';

const router = Router();
const controller = new AuthController();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), controller.resendVerification);
router.post('/login/mfa', validate(mfaLoginSchema), controller.loginMfa);
router.post('/mfa/setup', authenticate, controller.mfaSetup);
router.post('/mfa/enable', authenticate, validate(mfaEnableSchema), controller.mfaEnable);
router.post('/mfa/disable', authenticate, validate(mfaDisableSchema), controller.mfaDisable);
router.post('/mfa/backup-codes', authenticate, validate(mfaDisableSchema), controller.mfaRegenerateBackupCodes);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
router.post('/exchange-code', validate(exchangeCodeSchema), controller.exchangeOAuthCode);

// AUDIT-FIX OAUTH-1: Tell the frontend which OAuth providers are actually
// configured so it can hide buttons that would otherwise 500 / show confusing
// "Unknown authentication strategy" errors. Cheap, public, no auth needed.
router.get('/oauth-providers', (_req, res) => {
  sendSuccess(res, {
    google: Boolean(config.oauth.google.clientId && config.oauth.google.clientSecret),
    github: Boolean(config.oauth.github.clientId && config.oauth.github.clientSecret),
  });
});

// AUDIT-FIX OAUTH-2: Return clear 503 NOT_CONFIGURED instead of 500
// "Unknown authentication strategy" when env var missing.
function ensureProvider(provider: 'google' | 'github') {
  return (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const conf = config.oauth[provider];
    if (!conf.clientId || !conf.clientSecret) {
      return next(
        new AppError(
          `${provider === 'google' ? 'Google' : 'GitHub'} chưa được cấu hình trên máy chủ. Vui lòng dùng email và mật khẩu để đăng nhập.`,
          503,
          'OAUTH_NOT_CONFIGURED'
        )
      );
    }
    next();
  };
}

router.get('/google', ensureProvider('google'), async (req, res, next) => {
  const state = await generateOAuthState();
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next);
});

router.get('/google/callback', ensureProvider('google'), async (req, res, next) => {
  const valid = await validateOAuthState(req.query.state as string);
  if (!valid) {
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` })(req, res, next);
}, controller.googleCallback);

router.get('/github', ensureProvider('github'), async (req, res, next) => {
  const state = await generateOAuthState();
  passport.authenticate('github', { scope: ['user:email'], session: false, state })(req, res, next);
});

router.get('/github/callback', ensureProvider('github'), async (req, res, next) => {
  const valid = await validateOAuthState(req.query.state as string);
  if (!valid) {
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }
  passport.authenticate('github', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` })(req, res, next);
}, controller.githubCallback);

export default router;
