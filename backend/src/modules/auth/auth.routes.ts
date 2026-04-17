import { Router } from 'express';
import passport from 'passport';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, exchangeCodeSchema } from './auth.validator';
import { generateOAuthState, validateOAuthState } from '../../utils/oauthState';
import { config } from '../../config';

const router = Router();
const controller = new AuthController();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
router.post('/exchange-code', validate(exchangeCodeSchema), controller.exchangeOAuthCode);

router.get('/google', async (req, res, next) => {
  const state = await generateOAuthState();
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next);
});

router.get('/google/callback', async (req, res, next) => {
  const valid = await validateOAuthState(req.query.state as string);
  if (!valid) {
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` })(req, res, next);
}, controller.googleCallback);

router.get('/github', async (req, res, next) => {
  const state = await generateOAuthState();
  passport.authenticate('github', { scope: ['user:email'], session: false, state })(req, res, next);
});

router.get('/github/callback', async (req, res, next) => {
  const valid = await validateOAuthState(req.query.state as string);
  if (!valid) {
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }
  passport.authenticate('github', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` })(req, res, next);
}, controller.githubCallback);

export default router;
