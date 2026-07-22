import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  meHandler,
} from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validate({ body: registerSchema }), registerHandler);
authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), loginHandler);
authRouter.post('/refresh', authRateLimit, refreshHandler);
authRouter.post('/logout', logoutHandler);
authRouter.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmailHandler);
authRouter.post('/resend-verification', requireAuth, resendVerificationHandler);
authRouter.post(
  '/forgot-password',
  authRateLimit,
  validate({ body: forgotPasswordSchema }),
  forgotPasswordHandler,
);
authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), resetPasswordHandler);
authRouter.get('/me', requireAuth, meHandler);
