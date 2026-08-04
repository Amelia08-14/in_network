import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter, ACCENT_MAP, ACCENT_TEXT_MAP } from '@/components/ui/card';
import { SERVICE_CATEGORY_ACCENT } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ServiceCatalogItem } from '@/types';

export const CATEGORY_LABEL: Record<string, string> = {
  DOMICILIATION: 'Domiciliation',
  CREATION_ENTREPRISE: "Création d'entreprise",
  COMPTABILITE: 'Comptabilité',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  SECRETARIAT: 'Secrétariat',
  AUTRE: 'Autre',
};

// V2 — le rendu "ledger" (pointillés + libellé) cassait visuellement dès
// qu'un libellé de palier était long (ex: "Accompagnement complet (RC,
// statuts, NIF, NIS, CASNOS...)") : retour cliente explicite, "trop ancien".
// Remplacé par des lignes en chip (fond plein, coins arrondis) qui encaissent
// un libellé court ET long sans jamais chevaucher le prix.
export function ServiceCard({ service }: { service: ServiceCatalogItem }) {
  const accent = SERVICE_CATEGORY_ACCENT[service.category] ?? 'none';
  const label = CATEGORY_LABEL[service.category] ?? service.category;

  return (
    <Card accent={accent} className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pb-0">
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
          <ul className="mt-1 flex flex-col gap-2">
            {service.pricingTiers.map((tier) => (
              <li
                key={tier.label}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-ink-900/[0.03] px-3.5 py-2.5"
              >
                <span className="text-sm text-ink-600">{tier.label}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap font-heading font-bold tabular-nums text-ink-900">
                  {tier.price.toLocaleString('fr-FR')}
                  <span className="ml-1 text-xs font-semibold text-ink-500">DZD</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          service.priceFrom && (
            <p className="mt-1 rounded-xl bg-ink-900/[0.03] px-3.5 py-2.5 text-sm">
              <span className="text-ink-500">à partir de </span>
              <span className="font-heading font-bold text-ink-900">{service.priceFrom} DZD</span>
            </p>
          )
        )}
      </CardContent>

      <CardFooter className="pt-5">
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
