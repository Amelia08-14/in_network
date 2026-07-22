import Cookies from 'js-cookie';

const ACCESS_TOKEN_COOKIE = 'in_network_access';

// Cookie non httpOnly volontairement : le token d'accès est de toute façon
// renvoyé au client dans le corps JSON de /api/auth/login, et middleware.ts
// (édge, sans appel réseau) doit pouvoir en lire la présence/le rôle pour
// protéger /dashboard et /admin. Le refresh token, lui, reste httpOnly
// côté backend (cf. CDC §11 — aucune donnée sensible non nécessaire côté client).
export function setAccessTokenCookie(token: string) {
  Cookies.set(ACCESS_TOKEN_COOKIE, token, {
    expires: 1 / 96, // ~15 minutes
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export function getAccessTokenCookie(): string | undefined {
  return Cookies.get(ACCESS_TOKEN_COOKIE);
}

export function clearAccessTokenCookie() {
  Cookies.remove(ACCESS_TOKEN_COOKIE, { path: '/' });
}
