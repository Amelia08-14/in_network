import type { ServiceCatalogItem } from '@/types';

// L'API renvoie le catalogue par ordre alphabétique ; à l'écran on préfère
// l'ordre de la démarche d'un entrepreneur (s'installer, s'administrer, créer,
// sécuriser, comptabiliser, communiquer) — le même que les onglets de filtre.
export const CATEGORY_ORDER = [
  'SECRETARIAT',
  'ADMINISTRATION',
  'CREATION_ENTREPRISE',
  'JURIDIQUE',
  'COMPTABILITE',
  'MARKETING',
  'INCUBATION',
  'DOMICILIATION',
  'OFFRE',
  'DIASPORA',
  'AUTRE',
] as const;

/** Prix d'entrée d'un service : le palier le moins cher, sinon « à partir de » ; null = sur devis. */
export function entryPrice(service: Pick<ServiceCatalogItem, 'priceFrom' | 'pricingTiers'>): number | null {
  const tiers = service.pricingTiers ?? [];
  if (tiers.length) return Math.min(...tiers.map((tier) => Number(tier.price)));
  return service.priceFrom !== null && service.priceFrom !== undefined ? Number(service.priceFrom) : null;
}

/** Par prix croissant, les services « sur devis » en dernier (demande cliente 26/10/2026). */
export function byPrice(a: Pick<ServiceCatalogItem, 'priceFrom' | 'pricingTiers'>, b: Pick<ServiceCatalogItem, 'priceFrom' | 'pricingTiers'>) {
  const pa = entryPrice(a);
  const pb = entryPrice(b);
  if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
  return pa - pb;
}

export function sortServices(services: ServiceCatalogItem[]): ServiceCatalogItem[] {
  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  // Dans chaque catégorie : du moins cher au plus cher, puis par titre.
  return [...services].sort(
    (a, b) => rank(a.category) - rank(b.category) || byPrice(a, b) || a.title.localeCompare(b.title, 'fr'),
  );
}
