import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

// Options réglées par le super administrateur (demande client 25/10/2026) :
// - les listes de choix proposées dans le dashboard et sur le site (il ajoute
//   ou supprime des valeurs sans développement) ;
// - les rubriques du menu du dashboard masquées pour toute l'équipe.
// Valeurs par défaut = celles qui étaient écrites dans le code jusque-là.

export const OPTION_LISTS = {
  contactSubjects: {
    label: 'Formulaire de contact — sujets proposés',
    hint: 'Liste « Sujet de votre demande » de la page Contact ; le sujet choisi est repris sur le lead.',
    defaults: [
      'Visiter l’espace',
      'Bureaux privés et open space',
      'Salles de réunion et de formation',
      'Domiciliation',
      'Création d’entreprise',
      'Services aux entreprises',
      'Événements',
      'Partenariat',
      'Autre demande',
    ],
  },
  leadOffers: {
    label: 'CRM — offres vers lesquelles orienter un prospect',
    hint: 'Proposées à la création, à la qualification et sur la fiche d’un lead.',
    defaults: [
      'Starter',
      'Builder',
      'Accelerator',
      'Domiciliation Pro',
      'Event & Com',
      'Abonnement annuel Access',
      'Abonnement annuel Premium',
      'Abonnement annuel Elite',
      'Parcours diaspora',
    ],
  },
  lostReasons: {
    label: 'CRM — motifs de perte suggérés',
    hint: 'Suggestions quand un lead passe « Perdu » ; un autre motif peut toujours être saisi.',
    defaults: [] as string[],
  },
} as const;

export type OptionListKey = keyof typeof OPTION_LISTS;
const LIST_KEYS = Object.keys(OPTION_LISTS) as OptionListKey[];

const itemSchema = z.string().trim().min(1).max(120);
const listSchema = z.array(itemSchema).max(60);
const hiddenSchema = z.array(z.string().trim().min(1).max(120)).max(60);

export const optionsPatchSchema = z
  .object({
    lists: z.object(Object.fromEntries(LIST_KEYS.map((k) => [k, listSchema.optional()])) as Record<OptionListKey, z.ZodOptional<typeof listSchema>>).strict().optional(),
    hiddenModules: hiddenSchema.optional(),
  })
  .strict();

const listRowKey = (key: OptionListKey) => `options.${key}`;
const HIDDEN_KEY = 'options.hiddenModules';

export interface PlatformOptions {
  lists: Record<OptionListKey, string[]>;
  /** Rubriques du dashboard masquées (chemins /admin/…). */
  hiddenModules: string[];
}

export async function getOptions(): Promise<PlatformOptions> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: [...LIST_KEYS.map(listRowKey), HIDDEN_KEY] } } });
  const read = <T>(key: string, schema: z.ZodType<T>, fallback: T): T => {
    const parsed = schema.safeParse(rows.find((r) => r.key === key)?.value);
    return parsed.success ? parsed.data : fallback;
  };
  return {
    lists: Object.fromEntries(LIST_KEYS.map((k) => [k, read(listRowKey(k), listSchema, [...OPTION_LISTS[k].defaults])])) as Record<OptionListKey, string[]>,
    hiddenModules: read(HIDDEN_KEY, hiddenSchema, []),
  };
}

export async function describeOptions() {
  const options = await getOptions();
  return {
    lists: LIST_KEYS.map((key) => ({ key, label: OPTION_LISTS[key].label, hint: OPTION_LISTS[key].hint, values: options.lists[key], defaults: OPTION_LISTS[key].defaults })),
    hiddenModules: options.hiddenModules,
  };
}

export async function updateOptions(patch: z.infer<typeof optionsPatchSchema>, actorId: string) {
  const writes: { key: string; value: string[] }[] = [];
  for (const key of LIST_KEYS) {
    const values = patch.lists?.[key];
    // Doublons retirés, ordre conservé.
    if (values) writes.push({ key: listRowKey(key), value: [...new Set(values)] });
  }
  if (patch.hiddenModules) writes.push({ key: HIDDEN_KEY, value: [...new Set(patch.hiddenModules)] });
  await prisma.$transaction(
    writes.map(({ key, value }) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
        update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
      }),
    ),
  );
  return describeOptions();
}
