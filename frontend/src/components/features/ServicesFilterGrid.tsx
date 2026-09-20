'use client';

import { useState } from 'react';
import { ServiceCard } from '@/components/features/ServiceCard';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { sortServices } from '@/lib/services-order';
import { HUE, SERVICE_HUE } from '@/lib/palette';
import type { ServiceCatalogItem } from '@/types';

const CATEGORY_TABS: { label: string; value: ServiceCatalogItem['category'] | 'ALL' }[] = [
  { label: 'Tous', value: 'ALL' },
  { label: 'Secrétariat', value: 'SECRETARIAT' },
  { label: 'Administration', value: 'ADMINISTRATION' },
  { label: "Création d'entreprise", value: 'CREATION_ENTREPRISE' },
  { label: 'Juridique', value: 'JURIDIQUE' },
  { label: 'Comptabilité', value: 'COMPTABILITE' },
  { label: 'Communication', value: 'MARKETING' },
  { label: 'Domiciliation', value: 'DOMICILIATION' },
  { label: 'Autre', value: 'AUTRE' },
];

// Le client doit pouvoir choisir/parcourir par catégorie plutôt qu'une
// grille plate — même pattern de filtres pill que la galerie événements.
// On n'affiche que les catégories réellement présentes dans le catalogue
// (+ "Tous"), pour ne jamais proposer un filtre qui ne mène nulle part.
export function ServicesFilterGrid({ services }: { services: ServiceCatalogItem[] }) {
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]['value']>('ALL');
  const availableCategories = new Set(services.map((s) => s.category));
  const tabs = CATEGORY_TABS.filter((tab) => tab.value === 'ALL' || availableCategories.has(tab.value));

  const ordered = sortServices(services);
  const filtered = category === 'ALL' ? ordered : ordered.filter((s) => s.category === category);

  return (
    <>
      {tabs.length > 2 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setCategory(tab.value)}
              aria-pressed={tab.value === category}
              className={cn(
                'inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition-colors',
                tab.value === category
                  ? 'border-transparent bg-ink-900 text-white'
                  : cn('bg-white text-ink-700 hover:bg-ink-900/4', tab.value === 'ALL' ? 'border-ink-900/10' : HUE[SERVICE_HUE[tab.value] ?? 'gray'].border),
              )}
            >
              {tab.value !== 'ALL' && (
                <span aria-hidden className={cn('h-2 w-2 rounded-full', HUE[SERVICE_HUE[tab.value] ?? 'gray'].solid)} />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="Aucun service dans cette catégorie" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </>
  );
}
