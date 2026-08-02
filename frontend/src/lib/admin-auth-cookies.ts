import Cookies from 'js-cookie';

const ADMIN_ACCESS_TOKEN_COOKIE = 'in_network_admin_access';

// Cookie distinct de celui du site (in_network_access) — la session admin
// reste totalement indépendante d'une éventuelle session membre active dans
// le même navigateur (cf. backend/src/modules/auth/auth.controller.ts, même
// principe de séparation pour le cookie refresh httpOnly).
export function setAdminAccessTokenCookie(token: string) {
  Cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, token, {
    expires: 1 / 96, // ~15 minutes
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export function getAdminAccessTokenCookie(): string | undefined {
  return Cookies.get(ADMIN_ACCESS_TOKEN_COOKIE);
}

export function clearAdminAccessTokenCookie() {
  Cookies.remove(ADMIN_ACCESS_TOKEN_COOKIE, { path: '/' });
}
