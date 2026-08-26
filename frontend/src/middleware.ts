import { NextResponse, type NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

interface AccessTokenPayload {
  sub: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  exp: number;
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };

// Protection de routes par rôle (cf. CDC §7.3) — /admin vit dans la même app
// Next.js que le site public et /dashboard (architecture single-app fusionnée,
// pas dans une app séparée : le commentaire précédent ici décrivait un plan
// abandonné, et le matcher ne couvrait plus /admin du tout — faille RBAC
// critique confirmée par QA, un rôle MEMBER pouvait accéder librement aux
// pages /admin). Le token d'accès est lu depuis un cookie non httpOnly (posé
// côté client après login) et seulement décodé ici — pas vérifié
// cryptographiquement. L'autorisation réelle est de toute façon appliquée par
// le backend à chaque appel API (requireRole côté adminRouter) ; ce
// middleware est une seconde ligne de défense côté edge, pas la seule.
//
// Retour QA critique : le cookie d'access token ne vit que ~15 min (cf.
// auth-cookies.ts / admin-auth-cookies.ts) et n'est JAMAIS rafraîchi de façon
// proactive — seulement de façon réactive, après un 401, par apiFetch côté
// client. Rediriger immédiatement dès que ce cookie est absent/invalide (ce
// qui arrive dans les faits à chaque navigation espacée de plus de 15 min)
// cassait le flux de refresh silencieux prévu (cf. le commentaire de
// DashboardShell.tsx qui, lui, présuppose ce middleware comme un simple
// garde-fou "en complément" — pas la seule barrière). Deux tickets QA
// distincts ("dashboards totalement en panne" et "clic sur Membres qui
// retombe sur le Dashboard") avaient la même cause : ce comportement
// intermittent selon le temps écoulé depuis le dernier appel API.
// On distingue donc access absent/invalide (⇒ laisser passer, le hydrate()
// client tentera un refresh silencieux via le refresh token) de refresh
// absent (⇒ session définitivement terminée, redirection immédiate).
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');

  // /admin (racine, sans sous-chemin) EST l'écran de connexion admin
  // (AdminLoginScreen, cf. (admin)/layout.tsx) — il gère lui-même le cas
  // non-connecté / mauvais rôle en React. Rediriger vers /admin depuis /admin
  // créerait une boucle de redirection infinie ; seules les sous-routes
  // (/admin/membres, /admin/galerie, ...) sont gardées ici.
  if (pathname === '/admin') {
    return NextResponse.next();
  }

  // Session admin distincte de la session membre (cookies séparés, cf.
  // store/admin-auth.ts et backend/src/modules/auth/auth.controller.ts).
  const accessCookieName = isAdminRoute ? 'in_network_admin_access' : 'in_network_access';
  const refreshCookieName = isAdminRoute ? 'in_network_admin_refresh' : 'in_network_refresh';
  const token = req.cookies.get(accessCookieName)?.value;
  const hasRefreshToken = Boolean(req.cookies.get(refreshCookieName)?.value);

  if (!token) {
    // Pas d'access token mais un refresh token encore valide (30j) : on
    // laisse passer, le hydrate() côté client va rafraîchir la session dès
    // le montage de la page au lieu de rediriger l'utilisateur à tort.
    if (hasRefreshToken) return NextResponse.next();
    return NextResponse.redirect(new URL(isAdminRoute ? '/admin' : '/login', req.url));
  }

  // On ne vérifie pas l'expiration ici : le cookie peut être temporairement
  // périmé pendant qu'un refresh silencieux a lieu côté client (cf.
  // store/auth.ts hydrate() et lib/api.ts).
  let payload: AccessTokenPayload;
  try {
    payload = jwtDecode<AccessTokenPayload>(token);
  } catch {
    if (hasRefreshToken) return NextResponse.next();
    return NextResponse.redirect(new URL(isAdminRoute ? '/admin' : '/login', req.url));
  }

  if (isAdminRoute && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}
