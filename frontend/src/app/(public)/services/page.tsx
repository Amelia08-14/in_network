import { Fragment } from 'react';
import Link from 'next/link';
import { Check, ShoppingBasket } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { ServicesFilterGrid } from '@/components/features/ServicesFilterGrid';
import { Faq, type FaqItem } from '@/components/features/Faq';
import { serverGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { HUE, planHue, type Hue } from '@/lib/palette';
import type { CardAccent } from '@/components/ui/card';
import type { MembershipPlan, ServiceCatalogItem, SpaceResource } from '@/types';

export const revalidate = 3600;
export const metadata = {
  title: 'Services & tarifs',
  description:
    'Espaces, abonnements, salles de réunion et services aux entreprises à Hydra, Alger : la grille tarifaire IN NETWORK et une seule demande de devis.',
};

// Services et tarifs sont une seule et même offre : une page, quatre blocs
// ancrés (espaces → salles → services → FAQ). L'ancienne page /tarifs
// redirige ici (cf. next.config.mjs).
const SECTIONS: { id: string; label: string; hue: Hue }[] = [
  { id: 'espaces', label: 'Espaces & abonnements', hue: 'blue' },
  { id: 'salles', label: 'Salles de réunion', hue: 'teal' },
  { id: 'services', label: 'Services aux entreprises', hue: 'orange' },
  { id: 'faq', label: 'Questions fréquentes', hue: 'amber' },
];

const HUE_ACCENT: Record<Hue, CardAccent> = { blue: 'blue', orange: 'orange', green: 'green', amber: 'yellow', teal: 'teal', ink: 'ink', red: 'orange', gray: 'none' };

const CYCLE_LABEL: Record<string, string> = {
  DAY_PASS: '/ jour',
  MONTHLY: '/ mois',
  ANNUAL: '/ an',
};

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
    question: 'Comment demander un devis ?',
    answer:
      'Ajoutez à votre demande tout ce qui vous intéresse — formules, salles, services — puis envoyez-la en une fois depuis « Ma demande de devis ». L’équipe vous répond avec un devis unique, y compris pour les prestations sur devis.',
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

function BlockHeading({ title, lead, hue, n }: { title: string; lead: string; hue: Hue; n: number }) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <span aria-hidden className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-heading text-lg font-extrabold', HUE[hue].soft, HUE[hue].text)}>
        {n}
      </span>
      <div>
        <h2 className="font-heading text-2xl font-bold text-ink-900 md:text-3xl">{title}</h2>
        <span aria-hidden className={cn('mt-2 block h-1 w-12 rounded-full', HUE[hue].solid)} />
        <p className="mt-3 max-w-2xl text-ink-500">{lead}</p>
      </div>
    </div>
  );
}

// Chaque bloc de la page a sa teinte : bandeau doux + filet, pour se repérer
// en scrollant sans relire les titres.
const blockClass = (hue: Hue) => cn('scroll-mt-44 rounded-[2rem] border p-6 md:p-10', HUE[hue].wash, HUE[hue].border);

export default async function ServicesPage() {
  const [plans, spaces, services] = await Promise.all([
    serverGet<MembershipPlan[]>('/api/plans', 3600, [], 'plans'),
    serverGet<SpaceResource[]>('/api/spaces?type=MEETING_ROOM', 3600, [], 'spaces'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
  ]);

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Services & tarifs · pour les entreprises"
        title={
          <>
            Tout pour <span className="text-brand-orange">entreprendre</span>, au même endroit
          </>
        }
        description="Espaces, abonnements, salles de réunion et services pensés pour les entreprises : la grille tarifaire IN NETWORK Hydra, et une seule demande de devis pour tout."
      />

      <nav
        aria-label="Sur cette page"
        className="sticky top-24 z-30 -mt-4 mb-14 md:top-28"
      >
        <ul className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-ink-900/10 bg-white/85 p-1.5 shadow-soft backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-900 hover:text-white"
              >
                <span aria-hidden className={cn('h-2 w-2 rounded-full', HUE[section.hue].solid)} />
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="espaces" className={blockClass('blue')}>
        <BlockHeading
          n={1}
          hue="blue"
          title="Espaces & abonnements"
          lead="Domiciliation, bureaux en open space ou privatifs, casiers — au mois, prix hors taxes."
        />
        {plans.length === 0 ? (
          <EmptyState title="Grille tarifaire en cours de finalisation" description="Contacte-nous pour connaître nos offres actuelles." />
        ) : (
          <ScrollReveal stagger={80} className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} accent={HUE_ACCENT[planHue(plan.name)]}>
                <CardContent className="flex flex-col gap-5">
                  <div>
                    <h3 className={cn('font-heading text-lg font-bold', HUE[planHue(plan.name)].text)}>{plan.name}</h3>
                    {planTagline(plan.name) && (
                      <p className="mt-1 text-sm italic text-ink-500">{planTagline(plan.name)}</p>
                    )}
                    <p className="mt-2 flex items-baseline gap-1.5">
                      <span className="font-heading text-3xl font-bold text-ink-900">
                        {Number(plan.price).toLocaleString('fr-FR')}
                      </span>
                      <span className={cn('rounded-pill px-2 py-0.5 text-xs font-semibold', HUE[planHue(plan.name)].soft, HUE[planHue(plan.name)].text)}>
                        {plan.currency} HT {CYCLE_LABEL[plan.billingCycle]}
                      </span>
                    </p>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className={cn('mt-0.5 h-4 w-4 shrink-0', HUE[planHue(plan.name)].text)} /> {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-col items-center gap-3 pt-1">
                    <AddToCartButton
                      item={{
                        targetType: 'PLAN',
                        targetId: plan.id,
                        title: plan.name,
                        price: Number(plan.price),
                        priceUnit: plan.billingCycle,
                        category: 'PLAN',
                      }}
                      label="Ajouter au devis"
                      variant="primary"
                      size="lg"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollReveal>
        )}
      </section>

      {spaces.length > 0 && (
        <section id="salles" className={cn('mt-12', blockClass('teal'))}>
          <BlockHeading
            n={2}
            hue="teal"
            title="Salles de réunion"
            lead="Un cadre professionnel pour convaincre vos clients et signer plus vite. Tarif préférentiel pour les membres IN NETWORK, tarif standard pour les visiteurs externes."
          />
          <div className="overflow-x-auto rounded-card border border-ink-900/8 bg-white shadow-soft">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-teal-600/20 bg-teal-600/10 text-teal-900">
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
                        <span className="mr-1.5 rounded-pill bg-brand-blue/10 px-2 py-0.5 text-xs font-semibold text-brand-blue">Externe</span>
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
              <AddToCartButton
                key={space.id}
                item={{ targetType: 'SPACE', targetId: space.id, title: space.name, price: null, category: 'SPACE' }}
                label={`Demander ${space.name}`}
                variant="outline"
                size="sm"
              />
            ))}
          </div>
        </section>
      )}

      <section id="services" className={cn('mt-12', blockClass('orange'))}>
        <BlockHeading
          n={3}
          hue="orange"
          title="Services aux entreprises"
          lead="Secrétariat, formation et création d'entreprise à prix fixe ; RH, juridique, comptabilité et communication sur devis."
        />

        {services.length > 0 && (
          <Card accent="orange" className="mb-10">
            <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-heading text-lg font-bold text-ink-900">Compose ta demande de devis</p>
                <p className="mt-1 text-sm text-ink-500">
                  Ajoute plusieurs formules, salles ou services d&apos;un clic : l&apos;équipe te répond avec un seul devis, y
                  compris pour les prestations sur devis.
                </p>
              </div>
              <Link href="/devis" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'shrink-0 gap-2')}>
                <ShoppingBasket className="h-4 w-4" /> Voir ma demande
              </Link>
            </CardContent>
          </Card>
        )}

        {services.length === 0 ? (
          <EmptyState title="Catalogue en préparation" />
        ) : (
          <ServicesFilterGrid services={services} />
        )}
      </section>

      <section id="faq" className={cn('mt-12', blockClass('amber'))}>
        <BlockHeading n={4} hue="amber" title="Questions fréquentes" lead="Tout ce qu'il faut savoir avant de rejoindre IN NETWORK." />
        <Faq items={FAQ_ITEMS} />
      </section>
    </Container>
  );
}
