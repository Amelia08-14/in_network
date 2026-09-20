export type RequestItemLike = { title: string; tierLabel: string | null };

export function lineLabel(item: RequestItemLike) {
  return item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title;
}

// « Secrétariat — NET », « Secrétariat — NET + 2 autres »… (notifications,
// titre d'un lead créé depuis une demande de devis).
export function requestLabel(items: RequestItemLike[]) {
  if (items.length === 0) return 'votre demande';
  const first = lineLabel(items[0]);
  return items.length === 1 ? first : `${first} + ${items.length - 1} autre${items.length > 2 ? 's' : ''}`;
}
