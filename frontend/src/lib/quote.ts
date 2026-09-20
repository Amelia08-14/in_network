// Helpers partagés du panier de devis : côté visiteur (store du panier, page
// /devis) comme côté membre/admin (lignes d'une demande déjà envoyée).

export type QuoteTargetType = 'SERVICE' | 'SPACE' | 'PLAN';

/** Ligne d'une demande envoyée, telle que renvoyée par l'API. */
export interface QuoteItem {
  id: string;
  targetType: QuoteTargetType;
  title: string;
  tierLabel: string | null;
  /** Instantané pris à l'envoi ; null = sur devis. */
  unitPrice: string | null;
  priceUnit: string | null;
}

// Périodicité d'une formule d'abonnement (null = prix ponctuel d'un service).
export const PRICE_UNIT_SUFFIX: Record<string, string> = {
  MONTHLY: '/ mois',
  ANNUAL: '/ an',
  DAY_PASS: '/ jour',
};

export function formatDzd(value: number): string {
  return `${value.toLocaleString('fr-FR')} DZD`;
}

export function itemLabel(item: { title: string; tierLabel?: string | null }): string {
  return item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title;
}

/** « Secrétariat — NET », « Secrétariat — NET + 2 autres »… */
export function requestSummary(items: { title: string; tierLabel?: string | null }[]): string {
  if (items.length === 0) return 'Demande';
  const first = itemLabel(items[0]);
  return items.length === 1 ? first : `${first} + ${items.length - 1} autre${items.length > 2 ? 's' : ''}`;
}

export interface AmountRow {
  key: string;
  label: string;
  amount: number;
}

const GROUP_LABEL: Record<string, string> = {
  ONE_TIME: 'Prestations',
  MONTHLY: 'Abonnements, par mois',
  ANNUAL: 'Abonnements, par an',
  DAY_PASS: 'Accès à la journée',
};

/**
 * Totaux indicatifs d'un panier. On ne mélange pas un prix ponctuel avec un
 * abonnement mensuel : un total par périodicité, plus le nombre de lignes
 * « sur devis » que l'équipe chiffrera.
 */
export function summarizeAmounts(lines: { amount: number | null; unit: string | null | undefined }[]) {
  const totals = new Map<string, number>();
  let unpriced = 0;
  for (const line of lines) {
    if (line.amount == null || !Number.isFinite(line.amount)) {
      unpriced += 1;
      continue;
    }
    const group = line.unit || 'ONE_TIME';
    totals.set(group, (totals.get(group) ?? 0) + line.amount);
  }
  const rows: AmountRow[] = [...totals.entries()].map(([key, amount]) => ({
    key,
    label: GROUP_LABEL[key] ?? key,
    amount,
  }));
  return { rows, unpriced };
}
