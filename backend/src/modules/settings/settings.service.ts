import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

// Paramètres du processus commercial v1.3 réglables par l'administrateur, sans
// développement. Chaque clé a une valeur par défaut : une valeur absente en
// base (ou invalide) retombe sur celle-ci. Les valeurs « à fixer par IN
// NETWORK » (durée de protection d'un lead, seuil de validation des devis)
// valent null tant qu'elles ne sont pas renseignées : la règle correspondante
// est alors simplement inactive.

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const SETTINGS_SCHEMA = {
  /** Relances sans réponse avant le retour au responsable commercial (circuit 1) ou l'alerte à l'Office Manager (circuit 2). */
  followUpMaxAttempts: z.number().int().min(1).max(20),
  /** Délai (jours) proposé entre deux relances. */
  followUpIntervalDays: z.number().int().min(1).max(60),
  /** Suivi après une journée d'essai (jours). */
  trialFollowUpDays: z.number().int().min(1).max(30),
  /** Appels de check-in après l'activation d'un membre (jours). */
  checkInDays: z.array(z.number().int().min(1).max(365)).max(5),
  /** Alertes avant l'échéance d'un service (jours). */
  expiryAlertDays: z.array(z.number().int().min(1).max(365)).max(3),
  /** Délai de grâce après l'échéance avant de passer le service « Expiré » (jours). */
  expiryGraceDays: z.number().int().min(0).max(90),
  /** Durée de protection d'un lead de la Sales Team sans activité (jours) ; null = pas de règle. */
  leadProtectionDays: nullableInt(1, 365),
  /** Montant TTC au-delà duquel un devis est validé par la Direction ; null = pas de seuil. */
  quoteDirectionThreshold: z.number().min(0).max(1e10).nullable(),
  /** Les devis sur mesure du circuit 2 sont validés par la Direction. */
  directionApprovesOfficeManagerQuotes: z.boolean(),
  /** Remise totale (en % du HT) accordée sans validation ; null = toute remise est validée. */
  discountWithoutApprovalRate: z.number().min(0).max(100).nullable(),
  /** Salles de réunion : ouverture, bascule matin / après-midi, fermeture (heures pleines, heure d'Alger). */
  roomOpeningHour: z.number().int().min(0).max(23),
  roomMiddayHour: z.number().int().min(1).max(23),
  roomClosingHour: z.number().int().min(1).max(24),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };

export const DEFAULT_SETTINGS: Settings = {
  followUpMaxAttempts: 3,
  followUpIntervalDays: 5,
  trialFollowUpDays: 3,
  checkInDays: [7, 30],
  expiryAlertDays: [60, 30, 7],
  expiryGraceDays: 0,
  leadProtectionDays: null,
  quoteDirectionThreshold: null,
  directionApprovesOfficeManagerQuotes: true,
  discountWithoutApprovalRate: null,
  // Amplitude déjà utilisée par le site (8h–20h), coupure à 13h : à confirmer par IN NETWORK.
  roomOpeningHour: 8,
  roomMiddayHour: 13,
  roomClosingHour: 20,
};

export const SETTING_LABELS: Record<SettingKey, string> = {
  followUpMaxAttempts: 'Relances sans réponse avant retour au responsable',
  followUpIntervalDays: 'Délai entre deux relances (jours)',
  trialFollowUpDays: 'Suivi après une journée d’essai (jours)',
  checkInDays: 'Appels de check-in après l’activation (jours)',
  expiryAlertDays: 'Alertes avant échéance d’un service (jours)',
  expiryGraceDays: 'Délai de grâce après l’échéance (jours)',
  leadProtectionDays: 'Protection d’un lead de la Sales Team sans activité (jours)',
  quoteDirectionThreshold: 'Montant TTC au-delà duquel la Direction valide un devis',
  directionApprovesOfficeManagerQuotes: 'La Direction valide les devis sur mesure du circuit 2',
  discountWithoutApprovalRate: 'Remise accordée sans validation, jusqu’à (% du HT)',
  roomOpeningHour: 'Salles de réunion : ouverture (heure)',
  roomMiddayHour: 'Salles de réunion : fin du matin / début de l’après-midi (heure)',
  roomClosingHour: 'Salles de réunion : fermeture (heure)',
};

const KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

// Lecture fréquente (automatisations, devis) : un cache court suffit, vidé à chaque écriture.
let cache: { value: Settings; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await prisma.appSetting.findMany({ where: { key: { in: KEYS } } });
  const value = { ...DEFAULT_SETTINGS } as Record<SettingKey, unknown>;
  for (const row of rows) {
    const key = row.key as SettingKey;
    const parsed = SETTINGS_SCHEMA[key].safeParse(row.value);
    if (parsed.success) value[key] = parsed.data;
  }
  cache = { value: value as Settings, at: Date.now() };
  return cache.value;
}

export const settingsPatchSchema = z
  .object(Object.fromEntries(KEYS.map((key) => [key, SETTINGS_SCHEMA[key].optional()])) as { [K in SettingKey]: z.ZodOptional<(typeof SETTINGS_SCHEMA)[K]> })
  .strict();

export async function updateSettings(patch: Partial<Settings>, actorId: string): Promise<Settings> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [SettingKey, unknown][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
        update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
      }),
    ),
  );
  cache = null;
  return getSettings();
}

export async function describeSettings() {
  const value = await getSettings();
  return KEYS.map((key) => ({ key, label: SETTING_LABELS[key], value: value[key], defaultValue: DEFAULT_SETTINGS[key] }));
}
