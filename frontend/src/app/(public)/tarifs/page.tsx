import { Fragment } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import type { MembershipPlan, ServiceCatalogItem, SpaceResource } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Tarifs & abonnements' };

const CYCLE_LABEL: Record<string, string> = {
  DAY_PASS: '/ jour',
  MONTHLY: '/ mois',
  ANNUAL: '/ an',
};

const CYCLE_ACCENT = {
  DAY_PASS: 'ink',
  MONTHLY: 'orange',
  ANNUAL: 'blue',
} as const;

function formatDzd(value: string | null): string {
  if (!value) return '—';
  return `${Number(value).toLocaleString('fr-FR')} DA`;
}

export default async function TarifsPage() {
  const [plans, spaces, services] = await Promise.all([
    serverGet<MembershipPlan[]>('/api/plans', 3600, []),
    serverGet<SpaceResource[]>('/api/spaces?type=MEETING_ROOM', 3600, []),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, []),
  ]);

  const secondaryServices = services.filter((s) => s.pricingTiers && s.pricingTiers.length > 0);

  return (
    <Container className="section-padding">
      <PageHeader
        align="center"
        eyebrow="Tarifs"
        title={<>Des formules pensées pour chaque <span className="text-brand-orange">étape</span></>}
        description="Domiciliation, bureaux, casiers, salles de réunion et services entrepreneuriaux — la grille tarifaire IN NETWORK Hydra."
      />

      {plans.length === 0 ? (
        <EmptyState title="Grille tarifaire en cours de finalisation" description="Contacte-nous pour connaître nos offres actuelles." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              accent={CYCLE_ACCENT[plan.billingCycle as keyof typeof CYCLE_ACCENT] ?? 'none'}
              className="flex flex-col"
            >
              <CardContent className="flex flex-1 flex-col gap-4 pl-6">
                <div>
                  <h3 className="font-heading text-lg font-bold text-ink-900">{plan.name}</h3>
                  <p className="mt-2 font-heading text-3xl font-bold text-brand-orange">
                    {Number(plan.price).toLocaleString('fr-FR')} <span className="text-sm font-normal text-ink-500">{plan.currency} HT</span>
                  </p>
                  <p className="text-xs text-ink-500">{CYCLE_LABEL[plan.billingCycle]}</p>
                </div>
                <ul className="flex-1 space-y-2 text-sm text-ink-600">
                  {(plan.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}>
                  Choisir cette formule
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {spaces.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-1 font-heading text-2xl font-bold text-ink-900">Salles de réunion</h2>
          <p className="mb-6 text-ink-500">Tarif préférentiel pour les membres IN NETWORK, tarif standard pour les visiteurs externes.</p>
          <div className="overflow-x-auto rounded-card border border-ink-900/[0.08] bg-white shadow-soft">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/[0.08] bg-ink-900/[0.03] text-ink-700">
                  <th className="p-4 font-semibold">Salle</th>
                  <th className="p-4 font-semibold">1h</th>
                  <th className="p-4 font-semibold">Demi-journée</th>
                  <th className="p-4 font-semibold">Journée</th>
                </tr>
              </thead>
              <tbody>
                {spaces.map((space) => (
                  <Fragment key={space.id}>
                    <tr className="border-b border-ink-900/[0.06]">
                      <td rowSpan={2} className="p-4 align-top font-semibold text-ink-900">
                        {space.name}
                        <span className="mt-1 block text-xs font-normal text-ink-500">{space.capacity} places</span>
                      </td>
                      <td className="p-4 text-ink-700">
                        <span className="mr-1.5 rounded-pill bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">Membre</span>
                        {formatDzd(space.hourlyRateMember)}
                      </td>
                      <td className="p-4 text-ink-700">{formatDzd(space.halfDayRateMember)}</td>
                      <td className="p-4 text-ink-700">{formatDzd(space.dailyRateMember)}</td>
                    </tr>
                    <tr className="border-b border-ink-900/[0.06]">
                      <td className="p-4 text-ink-700">
                        <span className="mr-1.5 rounded-pill bg-ink-900/[0.06] px-2 py-0.5 text-xs font-semibold text-ink-700">Externe</span>
                        {formatDzd(space.hourlyRateExternal)}
                      </td>
                      <td className="p-4 text-ink-700">{formatDzd(space.halfDayRateExternal)}</td>
                      <td className="p-4 text-ink-700">{formatDzd(space.dailyRateExternal)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {secondaryServices.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-1 font-heading text-2xl font-bold text-ink-900">Services à la carte</h2>
          <p className="mb-6 text-ink-500">Secrétariat, création juridique d&apos;entreprise et accompagnement administratif.</p>
          <div className="grid gap-6 md:grid-cols-2">
            {secondaryServices.map((service) => (
              <Card key={service.id} accent="green">
                <CardContent className="pl-6">
                  <h3 className="font-heading text-lg font-bold text-ink-900">{service.title}</h3>
                  <p className="mt-2 text-sm text-ink-600">{service.description}</p>
                  <ul className="mt-4 space-y-2 border-t border-ink-900/[0.06] pt-4 text-sm">
                    {service.pricingTiers!.map((tier) => (
                      <li key={tier.label} className="flex items-center justify-between gap-2">
                        <span className="text-ink-700">{tier.label}</span>
                        <span className="font-semibold text-brand-orange">{tier.price.toLocaleString('fr-FR')} DA</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
