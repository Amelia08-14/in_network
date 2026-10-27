import type { ServiceCatalogItem } from '@/types';

// L'API renvoie le catalogue par ordre alphabétique ; à l'écran on suit l'ordre
// des familles du catalogue client (27/10/2026) — le même que les onglets de
// filtre : secrétariat, création d'entreprise, administration (RH + juridique),
// finance (comptabilité + commissariat aux comptes), communication, incubation.
export const CATEGORY_ORDER = [
  'SECRETARIAT',
  'CREATION_ENTREPRISE',
  'ADMINISTRATION',
  'COMPTABILITE',
  'MARKETING',
  'INCUBATION',
  'DOMICILIATION',
  'OFFRE',
  'DIASPORA',
  'AUTRE',
] as const;

/**
 * Famille affichée d'un service. L'expertise juridique fait partie de
 * l'Administration dans le catalogue : un service encore classé JURIDIQUE en
 * base (saisi depuis l'admin) est rangé avec elle, jamais dans un filtre à part.
 */
export function displayCategory(category: string): string {
  return category === 'JURIDIQUE' ? 'ADMINISTRATION' : category;
}

// Création d'entreprise : deux façons de faire, présentées ensemble (catalogue).
export const SERVICE_OPTION: Record<string, { n: 1 | 2; label: string }> = {
  'formation-creation-entreprise': { n: 1, label: 'Je comprends et je fais' },
  'creation-entreprise': { n: 2, label: 'Je délègue' },
};

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
    const index = CATEGORY_ORDER.indexOf(displayCategory(category) as (typeof CATEGORY_ORDER)[number]);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  // Dans chaque famille : l'option 1 avant l'option 2, puis du moins cher au plus cher, puis par titre.
  const option = (slug: string) => SERVICE_OPTION[slug]?.n ?? 0;
  return [...services].sort(
    (a, b) => rank(a.category) - rank(b.category) || option(a.slug) - option(b.slug) || byPrice(a, b) || a.title.localeCompare(b.title, 'fr'),
  );
}
