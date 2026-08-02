import rateLimit from 'express-rate-limit';

// CDC §11 — rate limiting renforcé sur /auth/* et /api/payments/* (5 req/min)
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie dans une minute' } },
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
