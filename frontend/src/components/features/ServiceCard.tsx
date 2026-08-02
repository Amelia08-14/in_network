import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter, ACCENT_MAP, ACCENT_TEXT_MAP } from '@/components/ui/card';
import { SERVICE_CATEGORY_ACCENT } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ServiceCatalogItem } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  DOMICILIATION: 'Domiciliation',
  CREATION_ENTREPRISE: "Création d'entreprise",
  COMPTABILITE: 'Comptabilité',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  SECRETARIAT: 'Secrétariat',
  AUTRE: 'Autre',
};

// Chaque service est en réalité une entrée de grille tarifaire officielle
// (domiciliation, création juridique...) — les prix sont donc traités comme
// un vrai ledger : libellé / ligne de pointillés (dot leader) / montant en
// chiffres tabulaires, à la manière d'un document tarifaire professionnel,
// plutôt qu'une liste générique flex-justify-between.
export function ServiceCard({ service }: { service: ServiceCatalogItem }) {
  const accent = SERVICE_CATEGORY_ACCENT[service.category] ?? 'none';
  const label = CATEGORY_LABEL[service.category] ?? service.category;

  return (
    <Card accent={accent} className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pb-0 pl-6">
        <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', ACCENT_MAP[accent])} />
          <span className={ACCENT_TEXT_MAP[accent]}>{label}</span>
        </span>

        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-xl font-bold leading-tight tracking-tight text-ink-900">
            {service.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-500">{service.description}</p>
        </div>

        {service.pricingTiers && service.pricingTiers.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-3 border-t border-dashed border-ink-900/10 pt-4">
            {service.pricingTiers.map((tier) => (
              <li key={tier.label} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-ink-600">{tier.label}</span>
                <span aria-hidden className="mb-[3px] h-0 flex-1 border-b border-dotted border-ink-900/25" />
                <span className="shrink-0 whitespace-nowrap font-heading font-bold tabular-nums text-ink-900">
                  {tier.price.toLocaleString('fr-FR')}
                  <span className="ml-1 text-xs font-semibold text-ink-500">DZD</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          service.priceFrom && (
            <p className="mt-1 border-t border-dashed border-ink-900/10 pt-4 text-sm">
              <span className="text-ink-500">à partir de </span>
              <span className="font-heading font-bold text-ink-900">{service.priceFrom} DZD</span>
            </p>
          )
        )}
      </CardContent>

      <CardFooter className="pl-6 pt-5">
        <Link
          href={`/services/${service.slug}`}
          className="group/cta inline-flex w-full items-center justify-between rounded-xl border border-ink-900/10 px-4 py-3 text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-brand-orange hover:bg-brand-orange hover:text-white"
        >
          Demander ce service
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}
