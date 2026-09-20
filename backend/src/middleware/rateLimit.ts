import rateLimit from 'express-rate-limit';

// CDC §11 — rate limiting renforcé sur /auth/* et /api/payments/* (5 req/min)
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie dans une minute' } },
});

// Connexion : on ne limite que les ÉCHECS (skipSuccessfulRequests), par couple
// IP + email — un membre qui se connecte normalement, ou un coworking dont tous
// les postes partagent la même IP, n'est jamais bloqué ; seul le tâtonnement de
// mots de passe l'est. Un second plafond par IP freine le bourrage d'identifiants
// sur plusieurs emails.
const LOGIN_BLOCKED = {
  error: { code: 'RATE_LIMITED', message: 'Trop d’échecs de connexion. Patientez quelques minutes ou utilisez « Mot de passe oublié ».' },
};
const loginPerAccount = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  message: LOGIN_BLOCKED,
});
const loginPerIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: LOGIN_BLOCKED,
});
export const loginRateLimit = [loginPerAccount, loginPerIp];

// Renouvellement de session : appelé automatiquement par le site (boucle de
// rafraîchissement, reprise après expiration) — jamais assimilé à une tentative.
export const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes, réessaie dans une minute' } },
});

// Création de compte : plafond horaire large (postes d'un même lieu derrière la même IP).
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop d’inscriptions depuis cette connexion, réessayez plus tard' } },
});

export const paymentsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes de paiement, réessaie dans une minute' } },
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Formulaires "Demander" ouverts aux visiteurs non connectés (services,
// tarifs) — pas de compte à limiter derrière, donc un rate limit dédié pour
// éviter le spam.
export const inquiryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de demandes envoyées, réessaie dans une minute' } },
});
