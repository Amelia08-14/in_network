import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiResponse';
import { env } from '../../config/env';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'in_network_refresh';
// Cookie distinct pour la session admin — /admin vit dans la même app Next.js
// que le site (principe repris d'IN ACADEMY), mais garde une session
// "totalement indépendante" de celle d'un membre dans le même navigateur :
// sans ça, se connecter en admin dans le même navigateur qu'une session
// membre écraserait le cookie refresh du membre (un seul nom = un seul slot).
const ADMIN_REFRESH_COOKIE = 'in_network_admin_refresh';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// path: '/' (et non '/api/auth') — retour QA critique : avec un scope
// restreint à /api/auth, le navigateur n'envoie JAMAIS ce cookie sur une
// requête vers une page Next.js (/dashboard, /admin/...), y compris les
// requêtes que middleware.ts inspecte à chaque navigation. Résultat : dès
// que le cookie d'access token (courte durée, ~15 min, cf. auth-cookies.ts)
// expirait, middleware.ts n'avait aucun moyen de savoir qu'une session
// valide existait encore (refresh token 30j) et redirigeait systématiquement
// vers /login ou /admin — perçu par les testeurs comme "dashboard totalement
// en panne" et "clic sur Membres qui retombe sur le Dashboard" (le timing de
// l'expiration du cookie de 15 min rendait le problème intermittent).
function setRefreshCookie(res: Response, token: string, cookieName = REFRESH_COOKIE) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/',
  });
}

function clearRefreshCookie(res: Response, cookieName = REFRESH_COOKIE) {
  res.clearCookie(cookieName, { path: '/' });
}

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  ok(res, { accessToken, user }, 201);
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  ok(res, { accessToken, user });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('Aucune session à rafraîchir');

  const { accessToken, refreshToken, user } = await authService.refresh(token);
  setRefreshCookie(res, refreshToken);
  ok(res, { accessToken, user });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await authService.logout(token);
  clearRefreshCookie(res);
  ok(res, { success: true });
});

// --- Session admin (/admin dans la même app, cookie refresh dédié) ---
export const adminLoginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.adminLogin(req.body);
  setRefreshCookie(res, refreshToken, ADMIN_REFRESH_COOKIE);
  ok(res, { accessToken, user });
});

export const adminRefreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('Aucune session à rafraîchir');

  const { accessToken, refreshToken, user } = await authService.adminRefresh(token);
  setRefreshCookie(res, refreshToken, ADMIN_REFRESH_COOKIE);
  ok(res, { accessToken, user });
});

export const adminLogoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
  if (token) await authService.logout(token);
  clearRefreshCookie(res, ADMIN_REFRESH_COOKIE);
  ok(res, { success: true });
});

export const verifyEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.body.token);
  ok(res, { success: true });
});

export const resendVerificationHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await authService.resendVerification(req.user.id);
  ok(res, { success: true });
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  ok(res, { success: true });
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  ok(res, { success: true });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const me = await authService.getMe(req.user.id);
  ok(res, me);
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  ok(res, { success: true });
});
