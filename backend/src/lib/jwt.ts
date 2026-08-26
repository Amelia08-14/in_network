import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import type { Role } from '../generated/prisma/client';

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

// jti aléatoire indispensable : sans lui, deux refresh tokens émis pour le
// même utilisateur dans la même seconde (payload {sub} + iat identiques,
// même secret) produisent le JWT signé EXACT MÊME STRING, donc le même hash
// SHA256 — l'INSERT en base percutait alors la contrainte unique sur
// tokenHash et faisait planter la requête (500 aléatoire, cf. QA #4 :
// double-clic sur Connexion, onglets multiples, inscription suivie d'une
// connexion immédiate...).
export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign({ ...payload, jti: randomToken(16) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string };
}

// Le refresh token brut n'est jamais stocké en DB — seul son hash l'est,
// pour permettre la révocation sans exposer le token en cas de fuite de la base.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
