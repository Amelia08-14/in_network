import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit, loginRateLimit, refreshRateLimit, registerRateLimit } from '../../middleware/rateLimit';
import {
  registerSchema,
  registerCompanySchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';
import {
  registerHandler,
  registerCompanyHandler,
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

authRouter.post('/register', registerRateLimit, validate({ body: registerSchema }), registerHandler);
authRouter.post(
  '/register-company',
  registerRateLimit,
  validate({ body: registerCompanySchema }),
  registerCompanyHandler,
);
authRouter.post('/login', loginRateLimit, validate({ body: loginSchema }), loginHandler);
authRouter.post('/refresh', refreshRateLimit, refreshHandler);
authRouter.post('/logout', logoutHandler);

// Session admin indépendante (cookie refresh distinct) — cf. auth.controller.ts
authRouter.post('/admin/login', loginRateLimit, validate({ body: loginSchema }), adminLoginHandler);
authRouter.post('/admin/refresh', refreshRateLimit, adminRefreshHandler);
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
authRouter.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), changePasswordHandler);
