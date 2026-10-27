import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Compass,
  Handshake,
  Lightbulb,
  LineChart,
  LogIn,
  MapPin,
  PartyPopper,
  Quote,
  Search,
  Sparkles,
  Sun,
  Trees,
  UserPlus,
  Users2,
  Wifi,
} from 'lucide-react';
import { Hero } from '@/components/features/Hero';
import { Section, SectionHeading } from '@/components/ui/section';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { TestimonialReels } from '@/components/features/TestimonialReels';
import { buttonVariants } from '@/components/ui/button';
import { ServiceCard } from '@/components/features/ServiceCard';
import { ServicesCarousel } from '@/components/features/ServicesCarousel';
import { EventCard } from '@/components/features/EventCard';
import { EmptyState } from '@/components/ui/empty-state';
import { NetworkMotif } from '@/components/ui/network-motif';
import { cn } from '@/lib/utils';
import { BrandTexture } from '@/components/ui/brand-texture';
import { serverGet } from '@/lib/server-api';
import { sortServices } from '@/lib/services-order';
import { VENUE_PHOTOS, type VenuePhoto } from '@/lib/venue-photos';
import { uniqueTestimonials, type Testimonial } from '@/lib/testimonials';
import type { ServiceCatalogItem, EventItem } from '@/types';

// Vitrine publique de la communauté (GET /api/profiles/showcase) : chiffres
// réels et aperçu limité — l'annuaire complet reste réservé aux connectés.
interface CommunityShowcase {
  members: number;
  sectors: number;
  profiles: { id: string; displayName: string; memberType: string; avatarUrl: string | null; jobTitle: string | null; city: string | null; tags: string[] }[];
}

const MEMBER_TYPE_LABEL: Record<string, string> = { FREELANCE: 'Freelance', STARTUP: 'Startup', ENTREPRISE: 'Entreprise', EXPERT: 'Expert' };

// Les trois leviers (audit du site, 25/10/2026) : un lieu, un réseau, des services.
const PILLARS: { n: string; kicker: string; title: string; description: string; href: string; photo: VenuePhoto; icon: typeof Building2 }[] = [
  {
    n: '01',
    kicker: 'Le lieu',
    title: 'Un espace pour travailler et entreprendre',
    description:
      'Bureaux privés, postes en open space et salles de réunion équipées, dans un environnement pensé pour la productivité, la collaboration et le développement de votre activité.',
    href: '/services#espaces',
    photo: VENUE_PHOTOS.openSpaceVue,
    icon: Building2,
  },
  {
    n: '02',
    kicker: 'Le réseau',
    title: 'Des contacts pertinents pour vos projets',
    description:
      'Un annuaire professionnel qualifié pour identifier des entrepreneurs, des experts, des partenaires et des opportunités en fonction de vos besoins et de vos objectifs.',
    href: '/annuaire',
    photo: VENUE_PHOTOS.terrasse,
    icon: Users2,
  },
  {
    n: '03',
    kicker: 'Les services',
    title: 'Les solutions pour faire grandir votre activité',
    description:
      'Domiciliation, création d’entreprise, accompagnement juridique, comptabilité, marketing et autres services essentiels : tout ce dont vous avez besoin pour avancer, au même endroit.',
    href: '/services#services',
    photo: VENUE_PHOTOS.salleReunion,
    icon: Sparkles,
  },
];

const PROCESS_STEPS = [
  { icon: UserPlus, title: 'Créez votre profil', description: 'Inscription en quelques minutes. Présentez votre activité, vos compétences et vos besoins.' },
  { icon: Search, title: 'Explorez le réseau', description: 'Parcourez l’annuaire et identifiez des entrepreneurs, des experts et des partenaires pertinents.' },
  { icon: CalendarCheck, title: 'Réservez un espace', description: 'Bureau privé, poste en open space ou salle de réunion : à l’heure, à la journée ou au mois.' },
  { icon: PartyPopper, title: 'Participez aux événements', description: 'Conférences, ateliers et rencontres pour développer votre réseau et saisir de nouvelles opportunités.' },
];

// Aperçu légendé des espaces (photos réelles du lieu).
const SPACE_GALLERY: { photo: VenuePhoto; caption: string; detail: string }[] = [
  { photo: VENUE_PHOTOS.terrasse, caption: 'La terrasse', detail: 'Un espace détente pour échanger et faire une pause' },
  { photo: VENUE_PHOTOS.grandeSalle, caption: 'Salle de réunion', detail: 'Idéale pour vos réunions professionnelles' },
  { photo: VENUE_PHOTOS.postes, caption: 'Espace de travail', detail: 'Un cadre motivant au quotidien' },
  { photo: VENUE_PHOTOS.cuisine, caption: 'Cuisine & pause café', detail: 'Café, thé et espace convivial' },
  { photo: VENUE_PHOTOS.salleReunion, caption: 'Salle de réunion compacte', detail: 'Un espace adapté à vos rendez-vous' },
];

const SPACE_FEATURES: { icon: typeof Building2; label: string }[] = [
  { icon: Building2, label: 'Bureaux & open space' },
  { icon: Users2, label: 'Salles de réunion' },
  { icon: Wifi, label: 'Wi-Fi fibre' },
  { icon: Trees, label: 'Terrasse & espace détente' },
];

const TESTIMONIAL_POINTS: { icon: typeof Building2; title: string; text: string }[] = [
  { icon: Users2, title: 'Des espaces adaptés', text: 'pour tous les profils' },
  { icon: Sun, title: 'Une ambiance conviviale', text: 'et professionnelle' },
  { icon: Lightbulb, title: 'Des opportunités', text: 'de rencontres et de collaboration' },
  { icon: LineChart, title: 'Un cadre qui booste', text: 'la productivité' },
];

const CTA_POINTS: { icon: typeof Building2; title: string; text: string }[] = [
  { icon: Users2, title: 'Rencontrez', text: 'des professionnels de confiance' },
  { icon: Handshake, title: 'Collaborez', text: 'sur de nouveaux projets' },
  { icon: LineChart, title: 'Développez', text: 'votre activité' },
  { icon: Lightbulb, title: 'Accédez', text: 'à des opportunités concrètes' },
];

export const revalidate = 3600;

/** Trois prochains rendez-vous et trois derniers événements passés (page en ISR : l'heure du rendu fait foi). */
function splitEvents(events: EventItem[]) {
  const now = Date.now();
  return {
    upcoming: events.filter((e) => new Date(e.endAt).getTime() >= now).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)).slice(0, 3),
    past: events.filter((e) => new Date(e.endAt).getTime() < now).sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt)).slice(0, 3),
  };
}

export default async function HomePage() {
  const [community, services, events, rawTestimonials] = await Promise.all([
    serverGet<CommunityShowcase>('/api/profiles/showcase', 900, { members: 0, sectors: 0, profiles: [] }, 'profiles'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
    serverGet<EventItem[]>('/api/events', 900, [], 'events'),
    serverGet<Testimonial[]>('/api/testimonials', 3600, [], 'testimonials'),
  ]);

  const { upcoming, past } = splitEvents(events);
  const testimonials = uniqueTestimonials(rawTestimonials);
  const featuredTestimonial = testimonials.find((t) => !t.videoUrl && t.content) ?? null;
  const otherTestimonials = testimonials.filter((t) => t.id !== featuredTestimonial?.id);
  // Chiffres affichés seulement quand ils sont parlants (annuaire encore en construction sinon).
  const showCommunityFigures = community.members >= 10;

  return (
    <>
      <Hero />

      {/* Bande navy structurelle — le positionnement, pas seulement le footer. */}
      <Section tone="navy" motifVariant="dense">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
          <SectionHeading
            tone="navy"
            eyebrow="Le parti pris"
            title={
              <>
                Votre entreprise mérite plus qu’un bureau.
                <br />
                <span className="text-brand-orange">Elle mérite un réseau.</span>
              </>
            }
            lead="IN NETWORK réunit en un même lieu tout ce dont les entrepreneurs ont besoin pour avancer : des espaces de travail, des services pour créer et structurer leur activité, des expertises pour accompagner leur développement et une communauté professionnelle qui favorise les rencontres et les collaborations."
          />
          <ScrollReveal stagger={110} className="grid gap-3 sm:grid-cols-3">
            {[
              ['+250', 'entreprises nous ont déjà fait confiance'],
              ['+20', 'startups accompagnées'],
              ['Hydra', 'au cœur d’Alger, à deux pas de tout ce qui compte'],
            ].map(([k, v]) => (
              <div key={k} className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="font-heading text-3xl font-bold text-brand-orange">{k}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{v}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <SectionHeading
            eyebrow="Ce que vous y trouvez"
            title={
              <>
                Trois leviers, <span className="text-brand-orange">un seul endroit.</span>
              </>
            }
          />
          <p className="border-l-2 border-brand-orange/40 pl-5 text-ink-600">
            Un lieu, un réseau et des services complémentaires pour vous accompagner à chaque étape de votre parcours entrepreneurial en Algérie.
          </p>
        </div>
        <ScrollReveal stagger={90} className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Link key={pillar.n} href={pillar.href} className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink-900/8 bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                    <pillar.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                    {pillar.n} · {pillar.kicker}
                  </p>
                </div>
                <h3 className="font-heading text-xl font-bold leading-snug text-ink-900">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{pillar.description}</p>
              </div>
              <div className="relative mx-4 mb-4 aspect-[16/9] overflow-hidden rounded-2xl">
                <Image src={pillar.photo.src} alt={pillar.photo.alt} fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-orange shadow-soft">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </ScrollReveal>
      </Section>

      <Section tone="tint">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <SectionHeading
            eyebrow="Comment ça marche"
            title={
              <>
                Du profil au <span className="text-brand-orange">réseau actif</span>, en quatre étapes.
              </>
            }
          />
          <div className="space-y-4">
            <p className="text-ink-600">Rejoignez un lieu, un réseau et des services pour avancer plus vite dans vos projets en Algérie.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
                <UserPlus className="h-4 w-4" /> Créer mon compte
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}>
                <LogIn className="h-4 w-4" />
                <span>
                  <span className="text-ink-500">Déjà membre ?</span> Connectez-vous
                </span>
              </Link>
            </div>
          </div>
        </div>
        <ScrollReveal className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 hidden h-px bg-ink-900/12 lg:block" />
          {PROCESS_STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col gap-4">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-orange bg-brand-paper-deep text-brand-orange">
                <step.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-heading text-xs font-bold tracking-[0.2em] text-ink-900/30">ÉTAPE 0{i + 1}</p>
                <h3 className="mt-1 font-heading text-lg font-bold text-ink-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{step.description}</p>
              </div>
            </div>
          ))}
        </ScrollReveal>
        <div className="mt-14 grid overflow-hidden rounded-[1.75rem] border border-ink-900/8 bg-white shadow-soft md:grid-cols-[1fr_1.4fr]">
          <div className="relative min-h-[200px]">
            <Image src={VENUE_PHOTOS.grandeSalle.src} alt={VENUE_PHOTOS.grandeSalle.alt} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-ink-900/80 via-ink-900/20 to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 font-heading text-xl font-bold text-white">
              Rejoignez une communauté <span className="text-brand-orange">d’entrepreneurs engagés.</span>
            </p>
          </div>
          <ul className="grid gap-4 p-6 sm:grid-cols-3 sm:items-center md:p-8">
            {[
              [LineChart, 'Un environnement professionnel stimulant'],
              [Handshake, 'Des connexions de qualité'],
              [Lightbulb, 'Des services concrets pour vos projets'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Building2;
              return (
                <li key={label as string} className="flex flex-col items-center gap-2 text-center text-sm text-ink-700">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                    <I className="h-5 w-5" />
                  </span>
                  {label as string}
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SectionHeading
            eyebrow="Découvrez notre espace"
            title={
              <>
                Votre espace de travail à Hydra. <span className="text-brand-orange">Bien plus qu’un bureau.</span>
              </>
            }
            lead="Des espaces pour travailler, recevoir vos clients et faire grandir votre réseau professionnel."
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {SPACE_FEATURES.map((feature) => (
              <li key={feature.label} className="flex flex-col items-center gap-2 text-center text-xs font-semibold text-ink-800">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                  <feature.icon className="h-5 w-5" />
                </span>
                {feature.label}
              </li>
            ))}
          </ul>
        </div>
        <ScrollReveal className="mt-10 grid gap-3 md:grid-cols-4 md:grid-rows-2">
          {SPACE_GALLERY.map((item, i) => (
            <figure key={item.caption} className={cn('relative overflow-hidden rounded-2xl', i === 0 ? 'aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto' : 'aspect-[4/3]')}>
              <Image src={item.photo.src} alt={item.photo.alt} fill sizes={i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 100vw'} className="object-cover" />
              <figcaption className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/92 px-3 py-2 shadow-soft backdrop-blur-sm sm:right-auto">
                <span className="block text-sm font-semibold text-ink-900">{item.caption}</span>
                <span className="block text-xs text-ink-500">{item.detail}</span>
              </figcaption>
            </figure>
          ))}
        </ScrollReveal>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/evenements/galerie" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}>
            Voir toutes les photos <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/services#espaces" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline-offset-4 hover:underline">
            Découvrir nos offres <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Section>

      <Section tone="navy">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SectionHeading
            tone="navy"
            eyebrow="Le réseau IN NETWORK"
            title={
              <>
                Découvrez les membres de la <span className="text-brand-orange">communauté</span>
              </>
            }
            lead="Entrepreneurs, experts, freelances et entreprises : ils font partie d’IN NETWORK et partagent les mêmes valeurs d’échange, de collaboration et d’opportunités. L’annuaire se construit progressivement avec les membres de notre communauté."
          />
          {showCommunityFigures && (
            <dl className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <dt className="text-xs text-white/60">Membres inscrits</dt>
                <dd className="font-heading text-2xl font-bold text-brand-orange">{community.members}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <dt className="text-xs text-white/60">Secteurs représentés</dt>
                <dd className="font-heading text-2xl font-bold text-brand-orange">{community.sectors}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <dt className="text-xs text-white/60">Une communauté</dt>
                <dd className="font-heading text-base font-bold text-white">locale et engagée</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Recherche : ouvre l'annuaire (réservé aux membres) avec les critères saisis. */}
        <form action="/annuaire" method="get" className="mt-10 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher un membre, une entreprise ou une compétence</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              name="q"
              placeholder="Rechercher un membre, une entreprise, une compétence…"
              className="h-12 w-full rounded-xl bg-transparent pl-11 pr-4 text-sm text-white placeholder:text-white/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-yellow"
            />
          </label>
          <button type="submit" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
            Rechercher dans l’annuaire <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {community.profiles.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/70">
            Les premiers membres validés apparaîtront ici. <Link href="/register" className="font-semibold text-brand-orange underline-offset-4 hover:underline">Rejoignez-les</Link>.
          </div>
        ) : (
          <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {community.profiles.map((p) => (
              <article key={p.id} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-ink-900">
                <div className="relative flex aspect-[4/3] items-center justify-center bg-brand-paper-deep">
                  {p.avatarUrl ? (
                    <Image src={p.avatarUrl} alt="" fill sizes="220px" className="object-cover" />
                  ) : (
                    <span className="font-heading text-3xl font-bold text-ink-900/40">{p.displayName.charAt(0)}</span>
                  )}
                </div>
                <div className="space-y-1.5 p-4">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.displayName}
                    <span className="rounded-pill bg-brand-orange/10 px-2 py-0.5 text-[11px] font-semibold text-brand-orange">{MEMBER_TYPE_LABEL[p.memberType] ?? 'Membre'}</span>
                  </p>
                  {p.jobTitle && <p className="text-sm text-ink-600">{p.jobTitle}</p>}
                  {p.city && (
                    <p className="flex items-center gap-1 text-xs text-ink-500">
                      <MapPin className="h-3 w-3" /> {p.city}
                    </p>
                  )}
                  {p.tags.length > 0 && (
                    <p className="flex flex-wrap gap-1 pt-1">
                      {p.tags.map((tag) => (
                        <span key={tag} className="rounded-pill bg-ink-900/[0.06] px-2 py-0.5 text-[11px] text-ink-700">
                          {tag}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-8 flex justify-center">
          <Link href="/annuaire" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
            Voir tout l’annuaire <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      <Section tone="paper">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Services & tarifs"
            title={
              <>
                Des services pour <span className="text-brand-orange">chaque étape</span>
              </>
            }
            lead="Secrétariat, création d’entreprise, administration, finance, communication et incubation — ajoutez-en plusieurs à une seule demande de devis."
          />
          <Link href="/services" className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'gap-2')}>
            Voir tous les services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {services.length === 0 ? (
          <EmptyState className="mt-12" title="Catalogue en préparation" />
        ) : (
          <div className="mt-12">
            <ServicesCarousel label="Services IN NETWORK">
              {sortServices(services).map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </ServicesCarousel>
          </div>
        )}
      </Section>

      {/* Agenda : à venir d'un côté, passés de l'autre — jamais d'événement passé sous « prochains ». */}
      <Section tone="tint">
        <SectionHeading
          eyebrow="Agenda IN NETWORK"
          title={
            <>
              Les prochains <span className="text-brand-orange">rendez-vous</span>
            </>
          }
          lead="Des rencontres pour apprendre, échanger et faire avancer vos projets."
        />
        {upcoming.length > 0 ? (
          // 1 à 3 rendez-vous : la grille suit leur nombre (pas de colonne vide).
          <ScrollReveal stagger={90} className={cn('mt-12 grid gap-5', upcoming.length === 1 ? 'max-w-md' : upcoming.length === 2 ? 'sm:grid-cols-2 lg:max-w-4xl' : 'sm:grid-cols-2 lg:grid-cols-3')}>
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ScrollReveal>
        ) : (
          <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-ink-900/8 bg-white p-8 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-lg font-bold text-ink-900">Les prochaines dates arrivent bientôt.</p>
              <p className="mt-1 text-sm text-ink-500">Créez votre compte pour être informé de l’ouverture des inscriptions.</p>
            </div>
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'shrink-0 gap-2')}>
              Être informé <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {past.length > 0 && (
          <div className="relative mt-14 overflow-hidden rounded-[2rem] bg-ink-900 p-6 md:p-10">
            <BrandTexture />
            <NetworkMotif tone="white" variant="sparse" className="pointer-events-none absolute -left-20 -top-20 h-[320px] w-[420px] opacity-15" />
            <div className="relative">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <SectionHeading
                  tone="navy"
                  eyebrow="En images"
                  title={
                    <>
                      Les moments qui ont <span className="text-brand-orange">fait vivre le réseau</span>
                    </>
                  }
                  lead="Retour sur nos rencontres, ateliers et temps forts."
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/evenements?when=past" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}>
                    Revivez nos événements <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/evenements/galerie" className={cn(buttonVariants({ variant: 'outline-light', size: 'md' }), 'gap-2')}>
                    Voir toutes les photos et vidéos
                  </Link>
                </div>
              </div>
              <ScrollReveal stagger={90} className="mt-10 grid gap-5 sm:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </ScrollReveal>
            </div>
          </div>
        )}
      </Section>

      {testimonials.length > 0 && (
        <Section tone="navy" motifVariant="sparse">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <SectionHeading
              tone="navy"
              eyebrow="Ils témoignent"
              title={
                <>
                  Ils ont choisi IN NETWORK pour <span className="text-brand-orange">travailler autrement.</span>
                </>
              }
              lead="Entrepreneurs, freelances, startups ou entreprises : découvrez leurs retours d’expérience et ce qu’ils apprécient dans nos espaces de coworking."
            />
            {featuredTestimonial && (
              <figure className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <Quote className="h-6 w-6 text-brand-orange" strokeWidth={2} />
                <blockquote className="mt-3 leading-relaxed text-white/90">{featuredTestimonial.content}</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-white">
                  {featuredTestimonial.authorName}
                  {(featuredTestimonial.authorRole || featuredTestimonial.authorContext) && (
                    <span className="font-normal text-white/60"> — {[featuredTestimonial.authorRole, featuredTestimonial.authorContext].filter(Boolean).join(' · ')}</span>
                  )}
                </figcaption>
              </figure>
            )}
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIAL_POINTS.map((point) => (
              <li key={point.title} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <point.icon className="h-5 w-5 shrink-0 text-brand-orange" />
                <span className="text-sm text-white/80">
                  <span className="font-semibold text-white">{point.title}</span> {point.text}
                </span>
              </li>
            ))}
          </ul>
          {otherTestimonials.length > 0 && (
            <div className="mt-10">
              <TestimonialReels items={otherTestimonials} />
            </div>
          )}
        </Section>
      )}

      <Section tone="paper">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-orange px-8 py-16 sm:px-16">
          <NetworkMotif tone="white" variant="sparse" className="pointer-events-none absolute -right-16 -top-16 h-[320px] w-[420px] opacity-20" />
          <div className="relative flex flex-col items-center gap-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Rejoignez IN NETWORK</p>
            <h2 className="max-w-2xl font-heading text-[clamp(1.8rem,3.5vw,2.75rem)] font-extrabold leading-tight tracking-[-0.015em] text-white">
              Votre prochaine opportunité commence ici.
            </h2>
            <p className="max-w-xl text-white/85">
              Rejoignez une communauté de professionnels engagés en Algérie pour développer votre activité, élargir votre réseau et faire avancer vos projets.
            </p>
            <ul className="mt-2 grid w-full max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
              {CTA_POINTS.map((point) => (
                <li key={point.title} className="flex items-start gap-2 text-sm text-white/85">
                  <point.icon className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  <span>
                    <span className="block font-semibold text-white">{point.title}</span>
                    {point.text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'gap-2')}>
                Rejoindre le réseau <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-white/40 px-7 text-base font-semibold text-white transition hover:bg-white/10"
              >
                <Compass className="h-4 w-4" /> Découvrir les services
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
