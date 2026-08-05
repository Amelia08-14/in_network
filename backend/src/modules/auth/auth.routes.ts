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
  changePasswordSchema,
} from './auth.schema';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  adminLoginHandler,
  adminRefreshHandler,
  adminLogoutHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  meHandler,
  changePasswordHandler,
} from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validate({ body: registerSchema }), registerHandler);
authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), loginHandler);
authRouter.post('/refresh', authRateLimit, refreshHandler);
authRouter.post('/logout', logoutHandler);

// Session admin indépendante (cookie refresh distinct) — cf. auth.controller.ts
authRouter.post('/admin/login', authRateLimit, validate({ body: loginSchema }), adminLoginHandler);
authRouter.post('/admin/refresh', authRateLimit, adminRefreshHandler);
authRouter.post('/admin/logout', adminLogoutHandler);
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
