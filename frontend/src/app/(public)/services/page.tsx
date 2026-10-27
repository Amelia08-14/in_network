import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarCheck,
  Check,
  Clock,
  Coffee,
  Compass,
  Globe2,
  Headphones,
  Network,
  Projector,
  Rocket,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Star,
  Mail,
  Trees,
  Users2,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { capacityText, hasMemberRate } from '@/lib/spaces';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { ServicesFilterGrid } from '@/components/features/ServicesFilterGrid';
import { Faq, type FaqItem } from '@/components/features/Faq';
import { serverGet } from '@/lib/server-api';
import { byPrice } from '@/lib/services-order';
import { cn } from '@/lib/utils';
import { CURRENCY, formatDa, formatNumber } from '@/lib/money';
import { HUE, planHue, type Hue } from '@/lib/palette';
import { VENUE_PHOTOS, type VenuePhoto } from '@/lib/venue-photos';
import { BrandTexture } from '@/components/ui/brand-texture';
import type { CardAccent } from '@/components/ui/card';
import type { MembershipPlan, ServiceCatalogItem, SpaceResource } from '@/types';

export const revalidate = 3600;
export const metadata = {
  title: 'Services & tarifs',
  description:
    'Bureaux privés, open space, domiciliation, salles de réunion et services aux entreprises à Hydra, Alger : les offres IN NETWORK et une seule demande de devis.',
};

// Services et tarifs sont une seule et même offre : une page, des blocs ancrés.
// L'ancienne page /tarifs redirige ici (cf. next.config.mjs). Contenu : catalogue
// IN NETWORK du 25/10/2026 et audit du site (accroches, bénéfices clients).

const SECTIONS: { id: string; label: string; hue: Hue }[] = [
  { id: 'offres', label: 'Nos offres', hue: 'orange' },
  { id: 'abonnements', label: 'Abonnement annuel', hue: 'ink' },
  { id: 'espaces', label: 'Espaces au mois', hue: 'blue' },
  { id: 'bureaux', label: 'Bureaux privés', hue: 'orange' },
  { id: 'salles', label: 'Salles de réunion', hue: 'ink' },
  { id: 'services', label: 'Services aux entreprises', hue: 'blue' },
  { id: 'etranger', label: 'Depuis l’étranger', hue: 'ink' },
  { id: 'lieu', label: 'Le lieu', hue: 'orange' },
  { id: 'faq', label: 'Questions fréquentes', hue: 'ink' },
];

const HUE_ACCENT: Record<Hue, CardAccent> = { blue: 'blue', orange: 'orange', green: 'green', amber: 'yellow', violet: 'violet', ink: 'ink', red: 'orange', gray: 'none' };

const CYCLE_LABEL: Record<string, string> = {
  DAY_PASS: '/ jour',
  MONTHLY: '/ mois',
  ANNUAL: '/ an',
};

// Habillage des formules au mois (bénéfice client + photo du lieu), associé par
// nom de formule : ce ne sont pas des données métier mais la mise en scène de cette page.
const PLAN_STYLE: { match: string; tagline: string; photo: VenuePhoto }[] = [
  { match: 'casier', tagline: 'Une solution pratique et sécurisée pour vos effets personnels.', photo: VENUE_PHOTOS.casiers },
  { match: 'domiciliation', tagline: 'Une adresse à Hydra qui inspire confiance à vos clients et partenaires dès le premier contact.', photo: VENUE_PHOTOS.detente },
  { match: 'open space rdc', tagline: 'Un poste dédié au cœur d’une communauté active, pour travailler, échanger et collaborer.', photo: VENUE_PHOTOS.openSpace },
  { match: 'open space roof', tagline: 'Votre poste de travail individuel, dans l’open space Roof.', photo: VENUE_PHOTOS.postes },
  { match: 'open space', tagline: 'Un poste dédié au cœur d’une communauté active, pour travailler, échanger et collaborer.', photo: VENUE_PHOTOS.openSpace },
];
const planStyle = (name: string) => PLAN_STYLE.find((style) => name.toLowerCase().includes(style.match));
const isPrivateOffice = (plan: MembershipPlan) => /bureau (privé|privatif|roof)/i.test(plan.name);

// Bureaux privés : ce qui distingue chaque taille (catalogue du 25/10/2026).
const OFFICE_TAGLINES: Record<number, string> = {
  2: 'Idéal pour travailler à deux, structurer votre activité et recevoir vos clients en toute discrétion.',
  4: 'Plus d’espace pour accueillir votre équipe et vos clients, avec deux demi-journées de salle de réunion par semaine.',
  8: 'Un bureau d’équipe avec balcon, pour une structure qui grandit.',
  14: 'Le plus grand bureau du lieu, avec balcon et accès à la terrasse rooftop.',
};

// Ordre des bureaux dans le catalogue (l'API les trie par nom).
const OFFICE_ORDER = ['Alpha', 'Bêta', 'Beta', 'Gamma', 'Delta', 'Lamda', 'Julia', 'Rouge', 'Vert', 'Orange', 'Roof'];
const officeRank = (name: string) => {
  const rank = OFFICE_ORDER.findIndex((n) => name.endsWith(n));
  return rank === -1 ? OFFICE_ORDER.length : rank;
};

// Photo de chaque salle (sélection de la galerie du lieu).
const ROOM_PHOTOS: Record<string, VenuePhoto> = {
  'Salle Network': VENUE_PHOTOS.salleReunion,
  'Salle LMIG': VENUE_PHOTOS.grandeSalle,
  'Salle de formation': VENUE_PHOTOS.salleProjection,
};

// « À qui s'adressent nos services ? » (catalogue des services, §06).
const PROFILES: [profile: string, services: string][] = [
  ['Entrepreneurs et créateurs d’entreprise', 'Création d’entreprise · Domiciliation · Coworking · Networking'],
  ['Startups et porteurs de projets', 'Coworking · Création · Incubation (IN CUBATOR) · Networking'],
  ['TPE / PME en développement', 'Bureaux privés · Domiciliation · Solutions du groupe · Networking'],
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

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Quelles formules propose IN NETWORK ?',
    answer:
      'Des offres regroupées par besoin (Starter, Builder, Accelerator, Domiciliation Pro, Événement & Com), l’abonnement annuel (Access, Premium, Elite), des formules au mois — poste en open space, bureau privé de 2 à 14 personnes, domiciliation, casier — ainsi que les salles de réunion et les services aux entreprises.',
  },
  {
    question: 'Qu’est-ce que la domiciliation chez IN NETWORK ?',
    answer:
      'La domiciliation permet d’établir le siège social de votre entreprise à l’adresse d’IN NETWORK à Hydra, avec réception et gestion de votre courrier et attestation de domiciliation. Elle est proposée en contrat annuel (155 652 DA TTC par an), seule ou dans les offres Domiciliation Pro, Builder et Événement & Com.',
  },
  {
    question: 'Quelle différence entre les bureaux privés ?',
    answer:
      'La taille et ce qui l’accompagne : jusqu’à 2 personnes (45 000 DA HT / mois, une demi-journée de salle de réunion par semaine), jusqu’à 4 personnes (65 000 DA HT, deux demi-journées), jusqu’à 8 personnes avec balcon (105 000 DA HT) et le bureau Roof jusqu’à 14 personnes, avec balcon et accès à la terrasse rooftop (205 000 DA HT). Tous sont fermés, meublés et accessibles 24h/24.',
  },
  {
    question: 'Comment réserver une salle de réunion ?',
    answer:
      'Les membres réservent depuis leur espace : la salle, le jour, puis le matin, l’après-midi ou la journée. Les visiteurs externes ajoutent la salle à leur demande de devis ou contactent l’équipe. Les membres IN NETWORK bénéficient d’un tarif préférentiel.',
  },
  {
    question: 'Les prix sont-ils HT ou TTC ?',
    answer:
      'Les tarifs des espaces et des formules au mois sont indiqués hors taxes. Les montants affichés restent indicatifs : un devis personnalisé vous est transmis par l’équipe IN NETWORK après étude de votre demande.',
  },
  {
    question: 'Comment demander un devis ?',
    answer:
      'Ajoutez à votre demande tout ce qui vous intéresse — formules, bureaux, salles, services — puis envoyez-la en une fois depuis « Ma demande de devis ». L’équipe vous répond avec un devis unique, y compris pour les prestations sur devis.',
  },
  {
    question: 'Puis-je visiter l’espace avant de m’engager ?',
    answer:
      'Oui. Choisissez « Visiter l’espace » dans le formulaire de contact ou appelez-nous : l’équipe vous propose un créneau pour découvrir les bureaux, les salles et la terrasse.',
  },
  {
    question: 'Quels sont les horaires d’accès ?',
    answer: 'L’accueil est ouvert de 9 h à 17 h ; les membres accèdent à leur espace 24h/24, 7j/7, selon les modalités de leur formule.',
  },
  {
    question: 'Qui peut accéder aux espaces IN NETWORK ?',
    answer:
      'L’accès aux espaces communs est réservé aux membres et à leurs invités. L’annuaire et les coordonnées des experts restent réservés aux utilisateurs disposant des droits d’accès appropriés.',
  },
];

// Les descriptions du catalogue sont « une phrase d'introduction, puis des puces ("• …") ».
function splitDescription(description: string) {
  const lines = description.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith('•')).map((line) => line.replace(/^•\s*/, ''));
  const intro = lines.filter((line) => !line.startsWith('•')).join(' ');
  return { intro, bullets };
}

// « 9 atouts qui font la différence » (catalogue du 25/10/2026).
const VENUE_ASSETS: { icon: typeof Clock; title: string; text: string }[] = [
  { icon: Clock, title: 'Accès 24h/24, 7j/7', text: 'Les meilleures idées ne suivent pas les horaires de bureau : avancez à votre rythme, selon les modalités de votre formule.' },
  { icon: Trees, title: 'Une terrasse-jardin de 150 m²', text: 'Respirez, échangez, inspirez-vous : une parenthèse entre deux rendez-vous.' },
  { icon: Coffee, title: 'Un espace café et brunch', text: 'Les meilleures rencontres ne se font pas toujours en salle de réunion.' },
  { icon: ShieldCheck, title: 'Un environnement sécurisé', text: 'Accès contrôlé et vidéosurveillance, pour travailler l’esprit tranquille.' },
  { icon: Users2, title: 'La Communauté IN', text: 'Événements, workshops et synergies avec La Maison IN Groupe : des rencontres qui ouvrent des portes.' },
  { icon: Rocket, title: 'IN CUBATOR', text: 'Un accès privilégié à l’accompagnement entrepreneurial, pour les startups, les PME du numérique et la diaspora.' },
  { icon: Building2, title: 'Des espaces adaptés', text: 'Du travail individuel aux échanges collectifs : un seul lieu, plusieurs façons d’avancer.' },
  { icon: Briefcase, title: 'Des services au quotidien', text: 'Moins de contraintes logistiques, plus de temps pour votre activité.' },
  { icon: Network, title: 'Un réseau qui dépasse les murs', text: 'Votre espace de travail devient un point de départ vers de nouvelles collaborations.' },
];

const LOCATION_POINTS: { title: string; text: string }[] = [
  { title: 'Des démarches facilitées', text: 'Banques, APC et services fiscaux à proximité.' },
  { title: 'Une accessibilité pratique', text: 'Depuis les axes routiers de Hydra et de Saïd Hamdine.' },
  { title: 'Un quartier dynamique', text: 'Restaurants, hôtels, poste, tribunal et transports à proximité.' },
  { title: 'Un accès sécurisé', text: 'Accès 24h/24, 7j/7 et vidéosurveillance, selon les modalités du site.' },
];

function roomRate(value: string | null): string {
  // Tarif non renseigné : la salle se demande sur devis.
  if (!value) return '—';
  return formatDa(value);
}

function BlockHeading({ title, lead, hue, n }: { title: React.ReactNode; lead: string; hue: Hue; n: number }) {
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

function Photo({ photo, className, sizes, priority = false }: { photo: VenuePhoto; className?: string; sizes: string; priority?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

// Blocs translucides posés sur le papier peint ; la teinte de chaque bloc
// (pastille numérotée, filet) aide à se repérer sans relire les titres.
const blockClass = () => 'scroll-mt-44 rounded-[2rem] border border-ink-900/8 bg-white/55 p-6 shadow-soft md:p-10';

const VISIT_HREF = `/contact?sujet=${encodeURIComponent('Visiter l’espace')}`;

export default async function ServicesPage() {
  const [allPlans, rooms, offices, allServices] = await Promise.all([
    serverGet<MembershipPlan[]>('/api/plans', 3600, [], 'plans'),
    serverGet<SpaceResource[]>('/api/spaces?type=MEETING_ROOM', 3600, [], 'spaces'),
    serverGet<SpaceResource[]>('/api/spaces?type=PRIVATE_OFFICE', 3600, [], 'spaces'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
  ]);
  // Formules mensuelles / bureaux privés / abonnement annuel / add-on domiciliation ;
  // offres par besoin, packs « depuis l'étranger » et services à la carte.
  const monthly = allPlans.filter((plan) => plan.billingCycle !== 'ANNUAL');
  const officePlans = monthly.filter(isPrivateOffice).sort((a, b) => Number(a.price) - Number(b.price));
  // Chaque partie est présentée du moins cher au plus cher (demande cliente 26/10/2026).
  const plans = monthly.filter((plan) => !isPrivateOffice(plan)).sort((a, b) => Number(a.price) - Number(b.price));
  const annualPlans = allPlans.filter((plan) => plan.billingCycle === 'ANNUAL' && plan.name.startsWith('Abonnement annuel')).sort((a, b) => Number(a.price) - Number(b.price));
  const domiciliationAddon = allPlans.find((plan) => plan.name.startsWith('Option domiciliation'));
  const offers = allServices.filter((service) => service.category === 'OFFRE').sort(byPrice);
  const packs = allServices.filter((service) => service.category === 'DIASPORA').sort((a, b) => byPrice(a, b) || a.slug.localeCompare(b.slug));
  const services = allServices.filter((service) => service.category !== 'OFFRE' && service.category !== 'DIASPORA');
  // Bureaux nommés, rangés par tarif (un tarif = une taille de bureau).
  const officesFor = (plan: MembershipPlan) =>
    offices
      .filter((office) => office.monthlyRate !== null && Number(office.monthlyRate) === Number(plan.price))
      .sort((a, b) => officeRank(a.name) - officeRank(b.name));
  const sections = SECTIONS.filter((s) => (s.id !== 'abonnements' || annualPlans.length > 0) && (s.id !== 'bureaux' || officePlans.length > 0) && (s.id !== 'salles' || rooms.length > 0) && (s.id !== 'etranger' || packs.length > 0));
  const number = (id: string) => sections.findIndex((s) => s.id === id);

  return (
    <>
      {/* Accroche (audit du site) : en quelques secondes, ce que le lieu apporte. */}
      <section className="relative -mt-24 overflow-hidden md:-mt-28">
        <div className="mx-auto grid max-w-[74rem] items-center gap-10 px-4 pb-14 pt-32 md:pt-36 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-brand-orange" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">IN NETWORK Hydra · Espaces & services professionnels</p>
            </div>
            <h1 className="mt-6 font-heading text-[clamp(2.4rem,4.6vw,3.6rem)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink-900">
              Vos ambitions méritent un lieu <span className="text-brand-orange">à leur hauteur.</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-lg leading-8 text-ink-600">
              Travaillez, réunissez vos équipes et développez votre activité dans un espace pensé pour les professionnels.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#espaces" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
                Découvrir nos espaces <ArrowRight className="h-4 w-4" />
              </a>
              <Link href={VISIT_HREF} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}>
                <CalendarCheck className="h-4 w-4" /> Réserver une visite
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-ink-900/10 pt-5 text-sm text-ink-700">
              {[
                [Clock, 'Accès 24h/24 · 7j/7 pour les membres'],
                [Users2, 'Coworking & bureaux privés'],
                [Projector, 'Salles de réunion et de formation'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Clock;
                return (
                  <li key={label as string} className="inline-flex items-center gap-2">
                    <I className="h-4 w-4 text-brand-orange" /> {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative">
            <Photo photo={VENUE_PHOTOS.openSpaceVue} sizes="(min-width: 1024px) 560px, 100vw" priority className="aspect-[4/3] rounded-[2rem] shadow-soft-lg" />
            <Photo photo={VENUE_PHOTOS.terrasse} sizes="220px" className="absolute -bottom-6 -left-4 hidden aspect-[4/3] w-[42%] rounded-2xl border-4 border-brand-paper shadow-soft-lg sm:block" />
          </div>
        </div>
      </section>

      <Container className="pb-24">
        <nav aria-label="Sur cette page" className="sticky top-24 z-30 mb-14 md:top-28">
          <ul className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-ink-900/10 bg-white/85 p-1.5 shadow-soft backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((section) => (
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

        <section id="offres" className={blockClass()}>
          <BlockHeading
            n={number('offres') + 1}
            hue="orange"
            title="Nos offres"
            lead="Construites par besoin : chacune regroupe les services les plus utiles à un profil ou à un objectif précis, pour démarrer vite et payer juste."
          />

          {offers.length === 0 ? (
            <EmptyState title="Offres en cours de finalisation" description="Contactez-nous pour connaître nos offres actuelles." />
          ) : (
            <ScrollReveal stagger={80} className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => {
                const { intro, bullets } = splitDescription(offer.description);
                const quote = bullets.find((line) => line.startsWith('«'));
                const audience = bullets.find((line) => line.startsWith('Pour :'));
                const points = bullets.filter((line) => line !== quote && line !== audience);
                return (
                  <Card key={offer.id} accent="orange" className="h-full">
                    <CardContent className="flex h-full flex-col gap-4">
                      <div>
                        <h3 className="font-heading text-lg font-bold text-ink-900">{offer.title}</h3>
                        {audience && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-orange">{audience.replace('Pour : ', 'Pour ')}</p>}
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

        </section>

        {/* Abonnement annuel : à part des cinq offres (demande cliente 26/10/2026) —
            une carte de membre de l'écosystème, sur un bandeau bleu nuit. */}
        {annualPlans.length > 0 && (
          <section id="abonnements" className="relative mt-12 scroll-mt-44 overflow-hidden rounded-[2rem] bg-ink-900 p-6 md:p-10">
            <BrandTexture />
            <div className="relative">
              <div className="mb-8 flex items-start gap-4">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange font-heading text-lg font-extrabold text-white">
                  {number('abonnements') + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Carte de membre IN NETWORK</p>
                  <h2 className="mt-1 font-heading text-2xl font-bold text-white md:text-3xl">
                    L’abonnement <span className="text-brand-orange">annuel</span>
                  </h2>
                  <p className="mt-3 max-w-3xl text-white/70">
                    Plus qu’un abonnement coworking : une carte de membre valable un an qui donne accès à l’ensemble de l’écosystème IN NETWORK — espace de travail, réseau, événements, services. Elle s’adresse aux professionnels flexibles, aux entrepreneurs en structuration et à la diaspora algérienne.
                  </p>
                </div>
              </div>
              <ScrollReveal stagger={80} className="grid items-stretch gap-6 md:grid-cols-3">
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
                <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
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
          </section>
        )}

        <section id="espaces" className={cn('mt-12', blockClass())}>
          <BlockHeading
            n={number('espaces') + 1}
            hue="blue"
            title={
              <>
                Espaces <span className="text-brand-orange">au mois</span>
              </>
            }
            lead="Des solutions flexibles pour travailler, développer votre activité et faire partie d’un réseau dynamique, au cœur d’IN NETWORK Hydra. Tarifs au mois, hors taxes."
          />
          {plans.length === 0 ? (
            <EmptyState title="Grille tarifaire en cours de finalisation" description="Contactez-nous pour connaître nos offres actuelles." />
          ) : (
            <ScrollReveal stagger={80} className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const style = planStyle(plan.name);
                const hue = planHue(plan.name);
                return (
                  <Card key={plan.id} accent={HUE_ACCENT[hue]} className="h-full overflow-hidden">
                    {style && <Photo photo={style.photo} sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 100vw" className="aspect-[16/10]" />}
                    <CardContent className="flex h-full flex-col gap-4">
                      <div>
                        <h3 className={cn('font-heading text-lg font-bold', HUE[hue].text)}>{plan.name}</h3>
                        {style && <p className="mt-1 text-sm text-ink-500">{style.tagline}</p>}
                        <p className="mt-3 flex items-baseline gap-1.5">
                          <span className="font-heading text-3xl font-bold text-ink-900">{Number(plan.price).toLocaleString('fr-FR')}</span>
                          <span className={cn('rounded-pill px-2 py-0.5 text-xs font-semibold', HUE[hue].soft, HUE[hue].text)}>
                            {CURRENCY} HT {CYCLE_LABEL[plan.billingCycle]}
                          </span>
                        </p>
                      </div>
                      {plan.features.length > 0 && (
                        <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className={cn('mt-0.5 h-4 w-4 shrink-0', HUE[hue].text)} /> {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      <AddToCartButton
                        item={{ targetType: 'PLAN', targetId: plan.id, title: plan.name, price: Number(plan.price), priceUnit: plan.billingCycle, category: 'PLAN' }}
                        label="Ajouter au devis"
                        variant="primary"
                        size="lg"
                        className="mt-auto w-full"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </ScrollReveal>
          )}
          <ul className="mt-8 grid gap-3 rounded-2xl border border-ink-900/8 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              [Clock, 'Accès 24h/24, 7j/7', 'Travaillez à votre rythme'],
              [Users2, 'Un réseau professionnel', 'Rencontrez et collaborez'],
              [Sparkles, 'Des espaces modernes', 'Pensés pour votre confort'],
              [ShieldCheck, 'Un environnement sécurisé', 'Sous vidéosurveillance'],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Clock;
              return (
                <li key={title as string} className="flex items-start gap-3">
                  <I className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                  <span>
                    <span className="block font-semibold text-ink-900">{title as string}</span>
                    <span className="text-ink-500">{text as string}</span>
                  </span>
                </li>
              );
            })}
            <li>
              <Link href="/contact" className="flex h-full items-center gap-3 rounded-xl bg-brand-blue/10 px-3 py-2 text-brand-blue hover:bg-brand-blue/15">
                <Headphones className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold">Une question ?</span>
                  Nous sommes là pour vous
                </span>
              </Link>
            </li>
          </ul>
        </section>

        {officePlans.length > 0 && (
          <section id="bureaux" className={cn('mt-12', blockClass())}>
            <BlockHeading
              n={number('bureaux') + 1}
              hue="orange"
              title={
                <>
                  Des bureaux privés adaptés à <span className="text-brand-orange">vos ambitions</span>
                </>
              }
              lead="Un espace fermé, meublé et confidentiel pour travailler, recevoir vos clients et développer votre activité — tout en restant connecté à l’écosystème IN NETWORK. Quatre tailles, de 2 à 14 personnes."
            />
            <div className="grid gap-6 lg:grid-cols-[0.8fr_2fr]">
              <Photo photo={VENUE_PHOTOS.bureauPrive} sizes="(min-width: 1024px) 320px, 100vw" className="hidden min-h-[320px] rounded-3xl lg:block" />
              <ScrollReveal stagger={80} className="grid items-stretch gap-5 sm:grid-cols-2">
                {officePlans.map((plan) => {
                  const named = officesFor(plan);
                  const capacity = named[0]?.capacity ?? Number(plan.name.match(/(\d+) personnes/)?.[1] ?? 0);
                  return (
                    <Card key={plan.id} accent="ink" className="h-full">
                      <CardContent className="flex h-full flex-col gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">{capacity > 0 ? `Jusqu’à ${capacity} personnes · bureau fermé` : 'Bureau fermé'}</p>
                          <h3 className="mt-1 font-heading text-lg font-bold text-ink-900">
                            {named.length > 0 ? named.map((o) => o.name.replace(/^Bureau /, '')).join(' · ') : plan.name}
                          </h3>
                          {OFFICE_TAGLINES[capacity] && <p className="mt-1 text-sm text-ink-500">{OFFICE_TAGLINES[capacity]}</p>}
                          <p className="mt-3 flex items-baseline gap-1.5">
                            <span className="font-heading text-3xl font-bold text-ink-900">{Number(plan.price).toLocaleString('fr-FR')}</span>
                            <span className="rounded-pill bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-800">{CURRENCY} HT / mois</span>
                          </p>
                        </div>
                        <ul className="space-y-1.5 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-600">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> {feature}
                            </li>
                          ))}
                        </ul>
                        <AddToCartButton
                          item={{ targetType: 'PLAN', targetId: plan.id, title: plan.name, price: Number(plan.price), priceUnit: plan.billingCycle, category: 'PLAN' }}
                          label="Ajouter au devis"
                          variant="primary"
                          size="lg"
                          className="mt-auto w-full"
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </ScrollReveal>
            </div>
            <p className="mt-6 text-sm text-ink-500">Chaque bureau porte un nom ; l’équipe vous attribue celui qui est disponible à la signature.</p>
          </section>
        )}

        {rooms.length > 0 && (
          <section id="salles" className={cn('mt-12', blockClass())}>
            <BlockHeading
              n={number('salles') + 1}
              hue="ink"
              title={
                <>
                  Des espaces professionnels adaptés à <span className="text-brand-orange">vos rendez-vous</span>
                </>
              }
              lead="Réunions, présentations commerciales, formations : profitez d’un cadre propice aux échanges, à la collaboration et au développement de vos projets, avec des tarifs préférentiels pour les membres d’IN NETWORK."
            />
            <div className="overflow-x-auto rounded-card border border-ink-900/8 bg-white shadow-soft">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-900/10 bg-ink-900 text-white">
                    <th className="p-4 font-semibold">Salle</th>
                    <th className="p-4 font-semibold">Capacité</th>
                    <th className="p-4 font-semibold">1 h</th>
                    <th className="p-4 font-semibold">Demi-journée</th>
                    <th className="p-4 font-semibold">Journée</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((space) => {
                    const photo = ROOM_PHOTOS[space.name];
                    return (
                      <Fragment key={space.id}>
                        <tr className="border-b border-ink-900/6">
                          <td rowSpan={2} className="max-w-sm p-4 align-top">
                            <div className="flex gap-3">
                              {photo && <Photo photo={photo} sizes="96px" className="hidden h-20 w-24 shrink-0 rounded-xl sm:block" />}
                              <div>
                                <p className="font-semibold text-ink-900">{space.name}</p>
                                {space.description && <p className="mt-1 text-xs leading-relaxed text-ink-500">{space.description}</p>}
                                {!hasMemberRate(space) && <span className="mt-1.5 inline-block rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Sur devis</span>}
                                <div className="mt-2">
                                  <AddToCartButton item={{ targetType: 'SPACE', targetId: space.id, title: space.name, price: null, category: 'SPACE' }} label="Demander cette salle" variant="outline" size="sm" />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td rowSpan={2} className="p-4 align-top text-ink-700">
                            <span className="inline-flex items-center gap-1.5">
                              <Users2 className="h-4 w-4 text-brand-blue" /> {capacityText(space)}
                            </span>
                          </td>
                          <td className="p-4 text-ink-700">
                            <span className="mr-1.5 rounded-pill bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">Membre</span>
                            {roomRate(space.hourlyRateMember)}
                          </td>
                          <td className="p-4 text-ink-700">{roomRate(space.halfDayRateMember)}</td>
                          <td className="p-4 text-ink-700">{roomRate(space.dailyRateMember)}</td>
                        </tr>
                        <tr className="border-b border-ink-900/6">
                          <td className="p-4 text-ink-700">
                            <span className="mr-1.5 rounded-pill bg-brand-blue/10 px-2 py-0.5 text-xs font-semibold text-brand-blue">Externe</span>
                            {roomRate(space.hourlyRateExternal)}
                          </td>
                          <td className="p-4 text-ink-700">{roomRate(space.halfDayRateExternal)}</td>
                          <td className="p-4 text-ink-700">{roomRate(space.dailyRateExternal)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                [Projector, 'Équipements inclus', 'Vidéoprojecteur, tableau blanc, internet'],
                [Coffee, 'Un cadre convivial', 'Terrasse et espace café sur place'],
                [CalendarCheck, 'Réservation simple', 'Depuis votre espace membre ou sur devis'],
                [ShieldCheck, 'Espaces sécurisés', 'Et confidentiels'],
              ].map(([Icon, title, text]) => {
                const I = Icon as typeof Clock;
                return (
                  <li key={title as string} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                    <span>
                      <span className="block font-semibold text-ink-900">{title as string}</span>
                      <span className="text-ink-500">{text as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 max-w-3xl text-sm text-ink-500">
              En extra : des espaces modulables pour vos événements, une connexion ultra-rapide et un projecteur 8K, selon la configuration et les disponibilités.
            </p>
          </section>
        )}

        <section id="services" className={cn('mt-12', blockClass())}>
          <BlockHeading
            n={number('services') + 1}
            hue="blue"
            title="Services aux entreprises"
            lead="Secrétariat, formation et création d’entreprise à prix fixe ; administration, fiscalité, communication et incubation sur devis."
          />

          {services.length > 0 && (
            <Card accent="orange" className="mb-10">
              <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-lg font-bold text-ink-900">Composez votre demande de devis</p>
                  <p className="mt-1 max-w-2xl text-sm text-ink-500">
                    Ajoutez plusieurs formules, salles ou services d’un clic. Les montants affichés sont indicatifs : un devis
                    personnalisé vous sera transmis par l’équipe IN NETWORK après étude de votre demande.
                  </p>
                </div>
                <Link href="/devis" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'shrink-0 gap-2')}>
                  <ShoppingBasket className="h-4 w-4" /> Voir ma demande
                </Link>
              </CardContent>
            </Card>
          )}

          {services.length === 0 ? <EmptyState title="Catalogue en préparation" /> : <ServicesFilterGrid services={services} />}

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
          <section id="etranger" className={cn('mt-12', blockClass())}>
            <BlockHeading
              n={number('etranger') + 1}
              hue="ink"
              title="De l’étranger à l’Algérie, faites grandir votre projet ici"
              lead="Vous vivez à l’étranger et souhaitez créer votre entreprise, développer une activité ou investir en Algérie ? IN NETWORK vous accompagne pour franchir les premières étapes de votre implantation, avec des solutions adaptées à votre projet et à votre niveau d’avancement."
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
                              {formatNumber(tier.price)} <span className="text-xs font-semibold text-ink-600">{CURRENCY}</span>
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

        <section id="lieu" className={cn('mt-12', blockClass())}>
          <BlockHeading
            n={number('lieu') + 1}
            hue="orange"
            title="Bien plus qu’un espace de travail : un écosystème pour aller plus loin"
            lead="Au cœur d’Alger, à deux pas de tout ce qui compte. Installé à Hydra, IN NETWORK vous place à proximité des banques, des administrations et des services du quotidien : moins de temps dans les déplacements, plus de temps pour vos projets."
          />
          <ol className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LOCATION_POINTS.map((point, i) => (
              <li key={point.title} className="rounded-2xl bg-white px-4 py-4 shadow-soft">
                <p className="font-heading text-xs font-bold tracking-[0.18em] text-brand-orange">0{i + 1}</p>
                <p className="mt-1 font-semibold text-ink-900">{point.title}</p>
                <p className="mt-0.5 text-sm text-ink-500">{point.text}</p>
              </li>
            ))}
          </ol>
          <h3 className="font-heading text-xl font-bold text-ink-900">9 atouts qui font la différence</h3>
          <ScrollReveal stagger={60} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VENUE_ASSETS.map((asset) => (
              <div key={asset.title} className="rounded-3xl border border-ink-900/8 bg-white p-5 shadow-soft">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
                  <asset.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <p className="mt-3 font-heading text-base font-bold text-ink-900">{asset.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{asset.text}</p>
              </div>
            ))}
          </ScrollReveal>
        </section>

        <section aria-label="Networking et communauté" className="relative mt-12 overflow-hidden rounded-[2rem] bg-ink-900 p-6 text-white md:p-10">
          <BrandTexture />
          <p className="eyebrow-light">Networking et développement relationnel</p>
          <h2 className="mt-3 max-w-2xl font-heading text-2xl font-bold text-white md:text-3xl">
            Un réseau de confiance, <span className="text-brand-orange">pas un réseau de cartes de visite.</span>
          </h2>
          <p className="mt-3 max-w-2xl text-white/75">
            IN NETWORK anime une communauté active d&apos;entrepreneurs, de freelances, de startups et de partenaires institutionnels, avec une programmation régulière d&apos;événements professionnels. L&apos;accès aux événements est inclus dans les abonnements ; certains sont ouverts aux non-membres sur inscription.
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {COMMUNITY_PROGRAMME.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className={cn('mt-12', blockClass())}>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.55fr]">
            <div>
              <BlockHeading n={number('faq') + 1} hue="ink" title="Questions fréquentes" lead="Tout ce qu’il faut savoir avant de rejoindre IN NETWORK." />
              <Faq items={FAQ_ITEMS} numbered />
            </div>
            <aside className="h-fit rounded-3xl bg-white p-6 shadow-soft lg:sticky lg:top-44">
              <Compass className="h-6 w-6 text-brand-orange" />
              <p className="mt-3 font-heading text-lg font-bold text-ink-900">Le mieux, c’est de venir voir.</p>
              <p className="mt-1 text-sm text-ink-500">Bureaux, salles, terrasse : l’équipe vous fait découvrir l’espace et vous aide à choisir la formule adaptée.</p>
              <div className="mt-5 flex flex-col gap-2">
                <Link href={VISIT_HREF} className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}>
                  <CalendarCheck className="h-4 w-4" /> Réserver une visite
                </Link>
                <Link href="/devis" className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'gap-2')}>
                  <ShoppingBasket className="h-4 w-4" /> Ma demande de devis
                </Link>
                <Link href="/contact" className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'gap-2')}>
                  <Mail className="h-4 w-4" /> Nous contacter
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </Container>
    </>
  );
}
