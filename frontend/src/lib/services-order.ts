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
  'DOMICILIATION',
  'AUTRE',
] as const;

export function sortServices(services: ServiceCatalogItem[]): ServiceCatalogItem[] {
  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  return [...services].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.title.localeCompare(b.title, 'fr'),
  );
}
