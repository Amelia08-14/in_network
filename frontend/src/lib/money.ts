// Notation monétaire unique du site (audit 27/10/2026) : « DA » partout, avec
// « HT » / « TTC » quand c'est pertinent — jamais « DZD ». La devise stockée
// en base (MembershipPlan.currency = 'DZD') reste un code technique, elle
// n'est pas affichée telle quelle.

export const CURRENCY = 'DA';

/** « 12 000 » (séparateur de milliers français). */
export function formatNumber(value: number | string): string {
  return Number(value).toLocaleString('fr-FR');
}

/** « 12 000 DA », « 45 000 DA HT » : espace insécable avant l'unité. */
export function formatDa(value: number | string, tax?: 'HT' | 'TTC'): string {
  return `${formatNumber(value)} ${CURRENCY}${tax ? ` ${tax}` : ''}`;
}
