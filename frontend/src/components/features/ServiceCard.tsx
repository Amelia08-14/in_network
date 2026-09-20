import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calculator,
  ClipboardCheck,
  Headset,
  MapPin,
  Megaphone,
  Scale,
  Sparkle,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { SERVICE_CATEGORY_ACCENT } from '@/components/ui/badge';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { HUE, SERVICE_HUE } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { ServiceCatalogItem } from '@/types';

export const CATEGORY_LABEL: Record<string, string> = {
  DOMICILIATION: 'Domiciliation',
  CREATION_ENTREPRISE: "Création d'entreprise",
  ADMINISTRATION: 'Administration',
  COMPTABILITE: 'Comptabilité',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Communication',
  SECRETARIAT: 'Secrétariat',
  AUTRE: 'Autre',
};

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  DOMICILIATION: MapPin,
  CREATION_ENTREPRISE: Building2,
  ADMINISTRATION: ClipboardCheck,
  COMPTABILITE: Calculator,
  JURIDIQUE: Scale,
  MARKETING: Megaphone,
  SECRETARIAT: Headset,
  AUTRE: Sparkle,
};

// V2 — le rendu "ledger" (pointillés + libellé) cassait visuellement dès
// qu'un libellé de palier était long (ex: "Accompagnement complet (RC,
// statuts, NIF, NIS, CASNOS...)") : retour cliente explicite, "trop ancien".
// Remplacé par des lignes en chip (fond plein, coins arrondis) qui encaissent
// un libellé court ET long sans jamais chevaucher le prix.
//
// Couleur : chaque catégorie a sa teinte (cf. lib/palette.ts) — médaillon
// d'icône, prix et lignes de tarif la reprennent, pour qu'on repère une
// famille de services d'un coup d'œil.
//
// Panier de devis : chaque palier porte son bouton « + » ; un service sans
// grille (« sur devis ») s'ajoute d'un bouton en pied de carte.
export function ServiceCard({ service }: { service: ServiceCatalogItem }) {
  const accent = SERVICE_CATEGORY_ACCENT[service.category] ?? 'none';
  const label = CATEGORY_LABEL[service.category] ?? service.category;
  const hue = HUE[SERVICE_HUE[service.category] ?? 'gray'];
  const Icon = CATEGORY_ICON[service.category] ?? Sparkle;
  const tiers = service.pricingTiers ?? [];

  return (
    <Card accent={accent} className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pb-0">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', hue.soft, hue.text)}>
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className={cn('text-xs font-semibold uppercase tracking-[0.14em]', hue.text)}>{label}</span>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-xl font-bold leading-tight tracking-tight text-ink-900">
            {service.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-500">{service.description}</p>
        </div>

        {tiers.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-2">
            {tiers.map((tier) => (
              <li
                key={tier.label}
                className={cn('flex items-center gap-3 rounded-xl border py-2 pl-3.5 pr-2', hue.soft, hue.border)}
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-ink-700">{tier.label}</span>
                <span className="shrink-0 whitespace-nowrap font-heading font-bold tabular-nums text-ink-900">
                  {tier.price.toLocaleString('fr-FR')}
                  <span className={cn('ml-1 text-xs font-semibold', hue.text)}>DZD</span>
                </span>
                <AddToCartButton
                  compact
                  item={{
                    targetType: 'SERVICE',
                    targetId: service.id,
                    title: service.title,
                    tierLabel: tier.label,
                    price: tier.price,
                    category: service.category,
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('mt-1 rounded-xl border border-dashed px-3.5 py-2.5 text-sm font-semibold', hue.border, hue.wash, hue.text)}>
            Sur devis
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-3 pt-5">
        {tiers.length === 0 && (
          <AddToCartButton
            variant="primary"
            item={{ targetType: 'SERVICE', targetId: service.id, title: service.title, price: null, category: service.category }}
            className="w-full"
          />
        )}
        <Link
          href={`/services/${service.slug}`}
          className="group/cta inline-flex w-full items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-900 hover:text-white"
        >
          Voir le détail
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}
