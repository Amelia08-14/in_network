import { NextResponse, type NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

interface AccessTokenPayload {
  sub: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  exp: number;
}

export const config = { matcher: ['/dashboard/:path*'] };

// Protection de routes par rôle (cf. CDC §7.3), adaptée à un backend séparé :
// le token d'accès est lu depuis un cookie non httpOnly (posé côté client
// après login, cf. lib/auth-cookies.ts) et seulement décodé ici — pas
// vérifié cryptographiquement. L'autorisation réelle est de toute façon
// appliquée par le backend à chaque appel API. Le dashboard admin vit
// désormais dans une app séparée (E:\in_network\admin) — plus de /admin ici.
export default function middleware(req: NextRequest) {
  const token = req.cookies.get('in_network_access')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // On ne vérifie pas l'expiration ici : le cookie peut être temporairement
  // périmé pendant qu'un refresh silencieux a lieu côté client (cf.
  // store/auth.ts hydrate() et lib/api.ts).
  try {
    jwtDecode<AccessTokenPayload>(token);
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
