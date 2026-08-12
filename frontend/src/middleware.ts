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
  const cookieName = isAdminRoute ? 'in_network_admin_access' : 'in_network_access';
  const token = req.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL(isAdminRoute ? '/admin' : '/login', req.url));
  }

  // On ne vérifie pas l'expiration ici : le cookie peut être temporairement
  // périmé pendant qu'un refresh silencieux a lieu côté client (cf.
  // store/auth.ts hydrate() et lib/api.ts).
  let payload: AccessTokenPayload;
  try {
    payload = jwtDecode<AccessTokenPayload>(token);
  } catch {
    return NextResponse.redirect(new URL(isAdminRoute ? '/admin' : '/login', req.url));
  }

  if (isAdminRoute && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}
