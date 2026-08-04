'use client';

import { useState } from 'react';
import { ServiceCard } from '@/components/features/ServiceCard';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { ServiceCatalogItem } from '@/types';

const CATEGORY_TABS: { label: string; value: ServiceCatalogItem['category'] | 'ALL' }[] = [
  { label: 'Tous', value: 'ALL' },
  { label: 'Domiciliation', value: 'DOMICILIATION' },
  { label: "Création d'entreprise", value: 'CREATION_ENTREPRISE' },
  { label: 'Comptabilité', value: 'COMPTABILITE' },
  { label: 'Juridique', value: 'JURIDIQUE' },
  { label: 'Marketing', value: 'MARKETING' },
  { label: 'Secrétariat', value: 'SECRETARIAT' },
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

  const filtered = category === 'ALL' ? services : services.filter((s) => s.category === category);

  return (
    <>
      {tabs.length > 2 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setCategory(tab.value)}
              className={cn(
                'rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
                tab.value === category ? 'bg-ink-900 text-white' : 'bg-ink-900/[0.05] text-ink-700 hover:bg-ink-900/[0.09]',
              )}
            >
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
