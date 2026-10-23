import { Fragment } from 'react';
import Link from 'next/link';
import { Check, Clock, Coffee, Globe2, Rocket, ShieldCheck, ShoppingBasket, Star, Trees, Users2 } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { capacityText, hasMemberRate } from '@/lib/spaces';
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

// Services et tarifs sont une seule et même offre : une page, des blocs ancrés
// (offres → espaces → salles → services → depuis l'étranger → le lieu → FAQ).
// L'ancienne page /tarifs redirige ici (cf. next.config.mjs). Contenu : catalogue
// des services et « Offre de service commerciale » fournis par le client.
// Ordre des offres dans la plaquette commerciale (l'API trie par titre).
const OFFER_ORDER = ['offre-starter', 'offre-builder', 'offre-accelerator', 'offre-domiciliation-pro', 'offre-evenement-com'];

const SECTIONS: { id: string; label: string; hue: Hue }[] = [
  { id: 'offres', label: 'Nos offres', hue: 'orange' },
  { id: 'espaces', label: 'Espaces & abonnements', hue: 'blue' },
  { id: 'salles', label: 'Salles de réunion', hue: 'violet' },
  { id: 'services', label: 'Services aux entreprises', hue: 'amber' },
  { id: 'etranger', label: 'Depuis l’étranger', hue: 'ink' },
  { id: 'lieu', label: 'Le lieu', hue: 'green' },
  { id: 'faq', label: 'Questions fréquentes', hue: 'gray' },
];

const HUE_ACCENT: Record<Hue, CardAccent> = { blue: 'blue', orange: 'orange', green: 'green', amber: 'yellow', violet: 'violet', ink: 'ink', red: 'orange', gray: 'none' };

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
  ['Bureau privatif', 'pour vos besoins spécifiques, un espace équipé alliant confidentialité et confort : votre propre bureau fermé, pour vous concentrer et recevoir en toute discrétion'],
  ['open space', 'favoriser la collaboration et l’échange d’idées : un poste dédié au cœur d’une communauté active, pour travailler, rencontrer et collaborer'],
];

// « À qui s'adressent nos services ? » (catalogue des services, §06).
const PROFILES: [profile: string, services: string][] = [
  ['Entrepreneurs et créateurs d’entreprise', 'Création d’entreprise · Domiciliation · Coworking · Networking'],
  ['Startups et porteurs de projets', 'Coworking · Création · Incubation (IN-CUBATOR) · Networking'],
  ['TPE / PME en développement', 'Bureaux privatifs · Domiciliation · Solutions du groupe · Networking'],
  ['Entreprises cherchant une présence en Algérie', 'Domiciliation · Création · Accompagnement diaspora · Espaces de réunion'],
  ['Diaspora algérienne', 'Accompagnement diaspora · Domiciliation à distance · Création · Networking'],
  ['Consultants, indépendants et professionnels', 'Coworking · Domiciliation · Networking'],
  ['Partenaires et acteurs de l’écosystème', 'Networking · Solutions du groupe · Mise en relation ciblée'],
];

// Networking et communauté (catalogue des services, fiche 4.5).
const COMMUNITY_PROGRAMME = [
  '1 workshop thématique tous les 45 jours',
  '1 journée portes ouvertes tous les 2 mois',
  'Accès à l’annuaire communautaire des membres',
  'Programme de parrainage membre-membre',
  'Mises en relation ciblées selon besoins et profils (sans engagement de résultat commercial)',
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

// Les descriptions du catalogue sont « une phrase d'introduction, puis des puces ("• …") ».
function splitDescription(description: string) {
  const lines = description.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith('•')).map((line) => line.replace(/^•\s*/, ''));
  const intro = lines.filter((line) => !line.startsWith('•')).join(' ');
  return { intro, bullets };
}

const VENUE_ASSETS: { icon: typeof Clock; title: string; text: string }[] = [
  { icon: Clock, title: 'Accès 24/7', text: 'Votre espace, votre temps. Façonnez votre réussite à votre rythme.' },
  { icon: Trees, title: 'Jardin terrasse de 150 m²', text: 'Un cadre lumineux et convivial pour se ressourcer, échanger et stimuler la créativité.' },
  { icon: Coffee, title: 'Espace café et brunch', text: 'Des boissons de qualité et des repas équilibrés, entre échanges et détente.' },
  { icon: ShieldCheck, title: 'Sécurité assurée', text: 'Une infrastructure sécurisée qui protège vos données et votre environnement de travail.' },
  { icon: Users2, title: 'Communauté IN', text: 'Événements, workshops thématiques et partenariats avec les filiales de La Maison IN Groupe pour apprendre, réseauter et faire grandir vos projets.' },
  { icon: Rocket, title: 'Lien avec l’incubateur', text: 'Un incubateur qui a accompagné de nombreux projets innovants et accueille aussi la diaspora souhaitant entreprendre ou investir en Algérie.' },
];

const LOCATION_POINTS = [
  'À deux pas des banques, de l’APC et des impôts : vos démarches se font à proximité.',
  'Accès facile depuis l’autoroute de Hydra et de Saïd Hamdine.',
  'Un quartier vivant : restaurants, hôtels, poste, tribunal et station de bus à proximité.',
  'Accès sécurisé 24h/24, 7j/7, avec vidéosurveillance.',
];

function formatDzd(value: string | null): string {
  // Tarif non renseigné : la salle se demande sur devis.
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
  const [allPlans, spaces, allServices] = await Promise.all([
    serverGet<MembershipPlan[]>('/api/plans', 3600, [], 'plans'),
    serverGet<SpaceResource[]>('/api/spaces?type=MEETING_ROOM', 3600, [], 'spaces'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
  ]);
  // Formules mensuelles / abonnement annuel / add-on domiciliation ; offres par besoin,
  // packs « depuis l'étranger » et services à la carte.
  const plans = allPlans.filter((plan) => plan.billingCycle !== 'ANNUAL');
  const annualPlans = allPlans.filter((plan) => plan.billingCycle === 'ANNUAL' && plan.name.startsWith('Abonnement annuel'));
  const domiciliationAddon = allPlans.find((plan) => plan.name.startsWith('Option domiciliation'));
  const offers = allServices.filter((service) => service.category === 'OFFRE').sort((a, b) => OFFER_ORDER.indexOf(a.slug) - OFFER_ORDER.indexOf(b.slug));
  const packs = allServices.filter((service) => service.category === 'DIASPORA');
  const services = allServices.filter((service) => service.category !== 'OFFRE' && service.category !== 'DIASPORA');

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Services & tarifs · pour les entreprises"
        title={
          <>
            Tout pour <span className="text-brand-orange">entreprendre</span>, au même endroit
          </>
        }
        description="Offres par besoin, abonnements, espaces, salles de réunion et services pensés pour les entreprises : la grille tarifaire IN NETWORK Hydra, et une seule demande de devis pour tout."
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

      <section id="offres" className={blockClass('orange')}>
        <BlockHeading
          n={1}
          hue="orange"
          title="Nos offres"
          lead="Les offres IN NETWORK sont construites par besoin : chacune regroupe les services les plus pertinents pour un profil ou un objectif précis."
        />

        {offers.length === 0 ? (
          <EmptyState title="Offres en cours de finalisation" description="Contactez-nous pour connaître nos offres actuelles." />
        ) : (
          <ScrollReveal stagger={80} className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {offers.map((offer) => {
              const { intro, bullets } = splitDescription(offer.description);
              const quote = bullets.find((line) => line.startsWith('«'));
              const points = bullets.filter((line) => line !== quote);
              return (
                <Card key={offer.id} accent="orange" className="h-full">
                  <CardContent className="flex h-full flex-col gap-4">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-ink-900">{offer.title}</h3>
                      <p className="mt-2 text-sm text-ink-600">{intro}</p>
                    </div>
                    <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                      {points.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> {point}
                        </li>
                      ))}
                    </ul>
                    {quote && <p className="text-sm italic text-ink-500">{quote}</p>}
                    <ul className="mt-auto flex flex-col gap-2">
                      {(offer.pricingTiers ?? []).map((tier) => (
                        <li key={tier.label} className="flex items-center gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/10 py-2 pl-3.5 pr-2">
                          <span className="min-w-0 flex-1 text-sm font-medium text-ink-700">{tier.label}</span>
                          <span className="shrink-0 whitespace-nowrap font-heading font-bold tabular-nums text-ink-900">
                            {tier.price.toLocaleString('fr-FR')}
                            <span className="ml-1 text-xs font-semibold text-brand-orange">DA</span>
                          </span>
                          <AddToCartButton
                            compact
                            item={{ targetType: 'SERVICE', targetId: offer.id, title: offer.title, tierLabel: tier.label, price: tier.price, category: offer.category }}
                          />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </ScrollReveal>
        )}

        {annualPlans.length > 0 && (
          <div className="mt-12">
            <h3 className="font-heading text-xl font-bold text-ink-900 md:text-2xl">Abonnement annuel</h3>
            <p className="mt-2 max-w-3xl text-ink-600">
              Plus qu&apos;un abonnement coworking : une carte de membre annuelle qui donne accès à l&apos;ensemble de
              l&apos;écosystème IN NETWORK — espace de travail, réseau, événements, services. Elle s&apos;adresse aux
              professionnels flexibles, aux entrepreneurs en structuration et à la diaspora algérienne.
            </p>
            <ScrollReveal stagger={80} className="mt-6 grid items-stretch gap-6 md:grid-cols-3">
              {annualPlans.map((plan) => {
                const recommended = plan.name.toUpperCase().includes('PREMIUM');
                const perMonth = plan.features.find((feature) => feature.startsWith('Soit '));
                const features = plan.features.filter((feature) => feature !== perMonth);
                const tier = plan.name.replace('Abonnement annuel ', '');
                return (
                  <Card key={plan.id} accent={HUE_ACCENT[planHue(plan.name)]} className={cn('h-full', recommended && 'ring-2 ring-brand-orange/50')}>
                    <CardContent className="flex h-full flex-col gap-5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={cn('font-heading text-lg font-bold', HUE[planHue(plan.name)].text)}>{tier}</h4>
                          {recommended && (
                            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-white">
                              <Star className="h-3 w-3" /> Recommandé
                            </span>
                          )}
                        </div>
                        <p className="mt-2 flex items-baseline gap-1.5">
                          <span className="font-heading text-3xl font-bold text-ink-900">{Number(plan.price).toLocaleString('fr-FR')}</span>
                          <span className="text-sm font-semibold text-ink-500">DA / an</span>
                        </p>
                        {perMonth && <p className="mt-0.5 text-sm text-ink-500">{perMonth.replace('Soit ', 'soit ')}</p>}
                      </div>
                      <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                        {features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', HUE[planHue(plan.name)].text)} /> {feature}
                          </li>
                        ))}
                      </ul>
                      <AddToCartButton
                        item={{ targetType: 'PLAN', targetId: plan.id, title: plan.name, price: Number(plan.price), priceUnit: plan.billingCycle, category: 'PLAN' }}
                        label="Ajouter au devis"
                        variant={recommended ? 'primary' : 'outline'}
                        size="lg"
                        className="mt-auto w-full"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </ScrollReveal>

            {domiciliationAddon && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-blue/25 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-base font-bold text-ink-900">
                    Option domiciliation — {Number(domiciliationAddon.price).toLocaleString('fr-FR')} DA / an
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-ink-600">
                    {domiciliationAddon.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <AddToCartButton
                  item={{ targetType: 'PLAN', targetId: domiciliationAddon.id, title: domiciliationAddon.name, price: Number(domiciliationAddon.price), priceUnit: domiciliationAddon.billingCycle, category: 'PLAN' }}
                  label="Ajouter l’option"
                  variant="outline"
                  size="md"
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section id="espaces" className={cn('mt-12', blockClass('blue'))}>
        <BlockHeading
          n={2}
          hue="blue"
          title="Espaces & abonnements"
          lead="Domiciliation, bureaux en open space ou privatifs, casiers — au mois, prix hors taxes. Bureau open space : un poste pour une personne ; bureau privatif A : un bureau fermé pour deux personnes."
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
        <section id="salles" className={cn('mt-12', blockClass('violet'))}>
          <BlockHeading
            n={3}
            hue="violet"
            title="Salles de réunion"
            lead="Des salles réservables à l'heure, le matin ou l'après-midi. Un cadre professionnel pour convaincre vos clients et signer plus vite. Tarif préférentiel pour les membres IN NETWORK, tarif standard pour les visiteurs externes. Salle de réunion : parfaite pour les réunions, les séances de travail ou l'accueil de vos collaborateurs. Salle de formation, sur demande : spacieuse et équipée, parfaite pour vos ateliers et sessions professionnelles. Des espaces modulables sont aussi disponibles pour vos événements (connexion ultra-rapide, projecteur 8K)."
          />
          <div className="overflow-x-auto rounded-card border border-ink-900/8 bg-white shadow-soft">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-violet-600/20 bg-violet-600/10 text-violet-900">
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
                      <td rowSpan={2} className="max-w-xs p-4 align-top font-semibold text-ink-900">
                        {space.name}
                        <span className="mt-1 block text-xs font-normal text-ink-500">{capacityText(space)}</span>
                        {space.description && <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-500">{space.description}</span>}
                        {!hasMemberRate(space) && <span className="mt-1.5 inline-block rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Sur devis</span>}
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

      <section id="services" className={cn('mt-12', blockClass('amber'))}>
        <BlockHeading
          n={4}
          hue="amber"
          title="Services aux entreprises"
          lead="Secrétariat, formation et création d'entreprise à prix fixe ; administration, fiscalité, communication et incubation sur devis."
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

        <div className="mt-12 rounded-3xl border border-ink-900/8 bg-white p-6 shadow-soft md:p-8">
          <h3 className="font-heading text-xl font-bold text-ink-900">À qui s&apos;adressent nos services ?</h3>
          <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {PROFILES.map(([profile, recommended]) => (
              <div key={profile}>
                <dt className="text-sm font-semibold text-ink-900">{profile}</dt>
                <dd className="mt-0.5 text-sm text-ink-500">{recommended}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {packs.length > 0 && (
        <section id="etranger" className={cn('mt-12', blockClass('ink'))}>
          <BlockHeading
            n={5}
            hue="ink"
            title="Entreprendre depuis l’étranger"
            lead="L’Algérie vous attend. Lancez-vous d’où vous êtes : premier échange à distance, domiciliation, coordination des démarches par IN NETWORK et interlocuteur de confiance sur place."
          />
          <ScrollReveal stagger={80} className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {packs.map((pack) => {
              const { intro, bullets } = splitDescription(pack.description);
              const tier = pack.pricingTiers?.[0];
              return (
                <Card key={pack.id} accent="ink" className="h-full">
                  <CardContent className="flex h-full flex-col gap-4">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-ink-900">{pack.title}</h3>
                      <p className="mt-2 text-sm text-ink-600">{intro}</p>
                    </div>
                    {bullets.length > 0 && (
                      <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                        {bullets.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-700" /> {point}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto">
                      {tier ? (
                        <p className="flex items-center gap-3 rounded-xl border border-ink-900/15 bg-ink-900/8 py-2 pl-3.5 pr-2">
                          <span className="flex-1 font-heading font-bold tabular-nums text-ink-900">
                            {tier.price.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-ink-600">DZD</span>
                          </span>
                          <AddToCartButton
                            compact
                            item={{ targetType: 'SERVICE', targetId: pack.id, title: pack.title, tierLabel: tier.label, price: tier.price, category: pack.category }}
                          />
                        </p>
                      ) : (
                        <AddToCartButton
                          variant="outline"
                          className="w-full"
                          label="Demander un devis"
                          item={{ targetType: 'SERVICE', targetId: pack.id, title: pack.title, price: null, category: pack.category }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </ScrollReveal>
          <p className="mt-6 max-w-3xl text-sm text-ink-500">
            IN NETWORK assure l’orientation et la coordination. Les actes juridiques, fiscaux et notariaux sont réalisés par
            les professionnels habilités ; certaines étapes nécessitent une présence physique selon la nature du projet.
            La création à distance se fait sous procuration consulaire, qui prend fin à l’obtention du dernier document.
          </p>
        </section>
      )}

      <section id="lieu" className={cn('mt-12', blockClass('green'))}>
        <BlockHeading
          n={6}
          hue="green"
          title="Le lieu"
          lead="Au cœur d’Alger, à deux pas de tout ce qui compte. Banques, APC, impôts, tribunal : votre quotidien d’entrepreneur se règle à pied. Moins de temps perdu dans les trajets et les démarches, plus de temps pour votre activité."
        />
        <ul className="mb-10 grid gap-3 md:grid-cols-2">
          {LOCATION_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink-700 shadow-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> {point}
            </li>
          ))}
        </ul>
        <ScrollReveal stagger={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VENUE_ASSETS.map((asset) => (
            <div key={asset.title} className="rounded-3xl border border-ink-900/8 bg-white p-5 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-green/20 text-green-800">
                <asset.icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <p className="mt-3 font-heading text-base font-bold text-ink-900">{asset.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{asset.text}</p>
            </div>
          ))}
        </ScrollReveal>
      </section>

      <section aria-label="Networking et communauté" className="mt-12 rounded-[2rem] bg-ink-900 p-6 text-white md:p-10">
        <p className="eyebrow-light">Networking et développement relationnel</p>
        <h2 className="mt-3 max-w-2xl font-heading text-2xl font-bold text-white md:text-3xl">
          Un réseau de confiance, <span className="text-accent-yellow">pas un réseau de cartes de visite.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-white/75">
          IN NETWORK anime une communauté active d&apos;entrepreneurs, de freelances, de startups et de partenaires institutionnels, avec une programmation régulière d&apos;événements professionnels. L&apos;accès aux événements est inclus dans les abonnements ; certains sont ouverts aux non-membres sur inscription.
        </p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {COMMUNITY_PROGRAMME.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/85">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" /> {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="faq" className={cn('mt-12', blockClass('gray'))}>
        <BlockHeading n={packs.length > 0 ? 7 : 6} hue="gray" title="Questions fréquentes" lead="Tout ce qu'il faut savoir avant de rejoindre IN NETWORK." />
        <Faq items={FAQ_ITEMS} />
      </section>
    </Container>
  );
}
