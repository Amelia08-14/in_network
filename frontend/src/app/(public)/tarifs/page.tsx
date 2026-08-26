import { Fragment } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { InquiryForm } from '@/components/features/InquiryForm';
import { Faq, type FaqItem } from '@/components/features/Faq';
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

// Accroches fournies telles quelles par la cliente (brief §4.10) — associées
// par nom de formule plutôt que stockées en base, ce ne sont pas des données
// métier mais un habillage marketing de cette page.
const PLAN_TAGLINES: [match: string, tagline: string][] = [
  ['Domiciliation', "une adresse qui inspire confiance à vos clients et partenaires dès le premier contact"],
  ['Bureau privatif', 'un espace à votre image, pour recevoir vos clients sans jamais douter de votre sérieux'],
  ['open space', 'un environnement qui vous connecte à d’autres entrepreneurs, chaque jour, sans effort'],
];
function planTagline(name: string): string | null {
  const match = PLAN_TAGLINES.find(([key]) => name.toLowerCase().includes(key.toLowerCase()));
  return match?.[1] ?? null;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Quelles formules propose IN Network ?',
    answer:
      "IN Network propose plusieurs formules adaptées aux besoins de chacun : accès bureau (open space), bureau privatif dédié, et formules de domiciliation ainsi que la création d'entreprise. Chaque formule peut être souscrite au mois ou sur engagement annuel.",
  },
  {
    question: "Qu'est-ce que la domiciliation chez IN Network ?",
    answer:
      "La domiciliation permet à une entreprise d'établir son siège social à l'adresse d'IN Network, avec réception du courrier.",
  },
  {
    question: 'Comment réserver une salle de réunion ?',
    answer:
      'Les salles de réunion et de formation sont réservables à l’heure ou à la journée, sur simple demande via le site ou l’équipe sur place, selon les disponibilités.',
  },
  {
    question: 'Quels services sont inclus ?',
    answer:
      "IN Network propose des espaces de travail (bureaux privatif, open space), des salles de réunion et de formation, la domiciliation et création d'entreprise, ainsi qu'un accompagnement et une mise en réseau entre entrepreneurs.",
  },
  {
    question: 'Comment réserver un espace ?',
    answer:
      'La réservation se fait via le formulaire du site, par WhatsApp ou directement auprès de l’équipe. Une confirmation est envoyée avant la visite ou l’accès à l’espace.',
  },
  {
    question: "Quels sont les horaires d'accès ?",
    answer: '09h–17h horaires d’ouverture au public, accès 24/24h pour les membres.',
  },
  {
    question: 'Qui peut accéder aux espaces IN Network ?',
    answer:
      "L'accès aux espaces communs est réservé aux membres et à leurs invités. L'annuaire et les coordonnées des experts restent réservés aux utilisateurs disposant des droits d'accès appropriés.",
  },
];

function formatDzd(value: string | null): string {
  if (!value) return '—';
  return `${Number(value).toLocaleString('fr-FR')} DA`;
}

export default async function TarifsPage() {
  const [plans, spaces, services] = await Promise.all([
    serverGet<MembershipPlan[]>('/api/plans', 3600, [], 'plans'),
    serverGet<SpaceResource[]>('/api/spaces?type=MEETING_ROOM', 3600, [], 'spaces'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
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
        <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} accent={CYCLE_ACCENT[plan.billingCycle as keyof typeof CYCLE_ACCENT] ?? 'none'}>
              <CardContent className="flex flex-col gap-5">
                <div>
                  <h3 className="font-heading text-lg font-bold text-ink-900">{plan.name}</h3>
                  {planTagline(plan.name) && (
                    <p className="mt-1 text-sm italic text-ink-500">{planTagline(plan.name)}</p>
                  )}
                  <p className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-heading text-3xl font-bold text-ink-900">
                      {Number(plan.price).toLocaleString('fr-FR')}
                    </span>
                    <span className="text-xs font-medium text-ink-500">
                      {plan.currency} HT {CYCLE_LABEL[plan.billingCycle]}
                    </span>
                  </p>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" /> {feature}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col items-center gap-3 pt-1">
                  <InquiryForm
                    targetType="PLAN"
                    targetId={plan.id}
                    ctaLabel="Choisir cette formule"
                    ctaVariant="primary"
                    className="w-full"
                    loggedOutHref="/register"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {spaces.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-1 font-heading text-2xl font-bold text-ink-900">Salles de réunion</h2>
          <p className="text-sm italic text-ink-500">
            Un cadre professionnel pour convaincre vos clients et signer plus vite.
          </p>
          <p className="mb-6 mt-1 text-ink-500">Tarif préférentiel pour les membres IN NETWORK, tarif standard pour les visiteurs externes.</p>
          <div className="overflow-x-auto rounded-card border border-ink-900/8 bg-white shadow-soft">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 bg-ink-900/3 text-ink-700">
                  <th className="p-4 font-semibold">Salle</th>
                  <th className="p-4 font-semibold">1h</th>
                  <th className="p-4 font-semibold">Demi-journée</th>
                  <th className="p-4 font-semibold">Journée</th>
                </tr>
              </thead>
              <tbody>
                {spaces.map((space) => (
                  <Fragment key={space.id}>
                    <tr className="border-b border-ink-900/6">
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
                    <tr className="border-b border-ink-900/6">
                      <td className="p-4 text-ink-700">
                        <span className="mr-1.5 rounded-pill bg-ink-900/6 px-2 py-0.5 text-xs font-semibold text-ink-700">Externe</span>
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

          <div className="mt-4 flex flex-wrap gap-3">
            {spaces.map((space) => (
              <InquiryForm
                key={space.id}
                targetType="SPACE"
                targetId={space.id}
                ctaLabel={`Réserver ${space.name}`}
                ctaVariant="outline"
                ctaSize="sm"
              />
            ))}
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
                <CardContent>
                  <h3 className="font-heading text-lg font-bold text-ink-900">{service.title}</h3>
                  <p className="mt-2 text-sm text-ink-600">{service.description}</p>
                  <ul className="mt-4 space-y-2 border-t border-ink-900/6 pt-4 text-sm">
                    {service.pricingTiers!.map((tier) => (
                      <li key={tier.label} className="flex items-center justify-between gap-2">
                        <span className="text-ink-700">{tier.label}</span>
                        <span className="font-semibold text-brand-orange">{tier.price.toLocaleString('fr-FR')} DA</span>
                      </li>
                    ))}
                  </ul>
                  <InquiryForm
                    targetType="SERVICE"
                    targetId={service.id}
                    options={[service, ...services.filter((item) => item.id !== service.id)].map((item) => ({
                      key: item.id,
                      targetId: item.id,
                      label: item.title,
                      subOptions: item.pricingTiers?.map((tier, index) => ({
                        key: `${item.id}-${index}`,
                        label: `${tier.label} — ${tier.price.toLocaleString('fr-FR')} DZD`,
                        noteHint: `Sous-service sélectionné : ${tier.label}\nTarif indicatif : ${tier.price.toLocaleString('fr-FR')} DZD`,
                      })),
                    }))}
                    ctaLabel="Demander ce service"
                    ctaVariant="outline"
                    ctaSize="sm"
                    className="mt-4"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <h2 className="mb-1 font-heading text-2xl font-bold text-ink-900">Questions fréquentes</h2>
        <p className="mb-6 text-ink-500">Tout ce qu&apos;il faut savoir avant de rejoindre IN NETWORK.</p>
        <Faq items={FAQ_ITEMS} />
      </section>
    </Container>
  );
}
