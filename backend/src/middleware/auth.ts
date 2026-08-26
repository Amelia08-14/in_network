import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/client';
import { verifyAccessToken } from '../lib/jwt';
import { ApiError } from '../utils/apiResponse';

// Décode le JWT d'accès si présent, sans jamais bloquer la requête.
// Utile pour les routes à visibilité mixte (ex. /api/profiles rend plus
// de champs à un membre connecté qu'à un visiteur, cf. CDC §6.2).
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // token invalide/expiré: on continue en visiteur anonyme
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw ApiError.unauthorized('Session expirée, reconnecte-toi');
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
