import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 4000);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  publicApiUrl: process.env.PUBLIC_API_URL ?? `http://localhost:${port}`,
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // URL canonique unique du frontend, utilisée pour générer les liens envoyés
  // par email (vérification, reset). Distincte de corsOrigin (qui peut
  // contenir plusieurs origines autorisées, ex. www + non-www) — un lien ne
  // doit jamais être construit à partir de ce tableau (bug QA : le lien
  // contenait littéralement "https://www.in-network.dz,https://in-network.dz/...").
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'IN NETWORK <no-reply@innetwork.dz>',

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  chargily: {
    apiKey: process.env.CHARGILY_API_KEY ?? '',
    webhookSecret: process.env.CHARGILY_WEBHOOK_SECRET ?? '',
  },

  // Émetteur des devis et factures (PDF). Les identifiants légaux (NIF, RC,
  // AI, NIS, RIB) ne sont jamais inventés : vides tant qu'ils ne sont pas
  // renseignés dans l'environnement, ils sont simplement omis du PDF.
  company: {
    name: process.env.COMPANY_NAME ?? 'IN NETWORK — La Maison IN Groupe',
    address: process.env.COMPANY_ADDRESS ?? 'Hydra, Alger, Algérie',
    phone: process.env.COMPANY_PHONE ?? '+213 5 60 06 74 86',
    email: process.env.COMPANY_EMAIL ?? 'Contact@in-network.dz',
    nif: process.env.COMPANY_NIF ?? '',
    rc: process.env.COMPANY_RC ?? '',
    ai: process.env.COMPANY_AI ?? '',
    nis: process.env.COMPANY_NIS ?? '',
    rib: process.env.COMPANY_RIB ?? '',
  },

  matchingScoreThreshold: Number(process.env.MATCHING_SCORE_THRESHOLD ?? 40),

  isProduction: process.env.NODE_ENV === 'production',
};
