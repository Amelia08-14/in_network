import Image from 'next/image';
import Link from 'next/link';
import {
  Armchair,
  ArrowRight,
  ExternalLink,
  BarChart3,
  Flower2,
  Building2,
  Code2,
  Compass,
  GraduationCap,
  Shirt,
  Megaphone,
  Network,
  Palette,
  Quote,
  Rocket,
  Settings2,
  Smile,
  Users2,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { NetworkMotif } from '@/components/ui/network-motif';
import { BrandTexture } from '@/components/ui/brand-texture';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VENUE_PHOTOS, type VenuePhoto } from '@/lib/venue-photos';

export const metadata = {
  // Le suffixe « — IN NETWORK » vient du gabarit du layout racine.
  title: 'À propos',
  description:
    'Née à Hydra, Alger, IN NETWORK associe un lieu de travail, une communauté professionnelle et des services pour accompagner les ambitions entrepreneuriales. La Maison IN Groupe.',
};

// Présentation de l'entreprise, restructurée d'après l'audit du site
// (25/10/2026) : un message institutionnel, les trois piliers (lieu, réseau,
// services), l'ambition, la vision en trois horizons et l'écosystème du groupe.
// Seuls les engagements et chiffres justifiables sont conservés.

const PILLARS = [
  { icon: Armchair, title: 'Un lieu pour travailler', text: 'Des espaces conçus pour la concentration, les échanges et la collaboration.' },
  { icon: Users2, title: 'Un réseau pour avancer', text: 'Des professionnels aux compétences complémentaires.' },
  { icon: Settings2, title: 'Des services pour entreprendre', text: 'Des solutions utiles à chaque étape du développement.' },
];

const HORIZONS: { n: string; kicker: string; title: string; text: string; tags: string[]; photo: VenuePhoto; icon: typeof Users2 }[] = [
  {
    n: '01',
    kicker: 'Un lieu pour travailler',
    title: 'Des espaces qui inspirent et font avancer.',
    text: 'Des espaces de travail modernes, flexibles et équipés, pensés pour la concentration, les échanges et la collaboration. Un environnement professionnel qui favorise la créativité et la performance.',
    tags: ['Coworking', 'Bureaux privés', 'Salles de réunion'],
    photo: VENUE_PHOTOS.openSpaceVue,
    icon: Building2,
  },
  {
    n: '02',
    kicker: 'Un réseau pour avancer',
    title: 'Une communauté de professionnels engagés.',
    text: 'Entrepreneurs, freelances, startups, PME, experts et partenaires : un réseau qualifié qui facilite les rencontres, les synergies et les opportunités de développement.',
    tags: ['Mise en relation', 'Événements', 'Partenariats'],
    photo: VENUE_PHOTOS.terrasse,
    icon: Users2,
  },
  {
    n: '03',
    kicker: 'Des services pour entreprendre',
    title: 'Des solutions à chaque étape du parcours.',
    text: 'Un accompagnement concret pour structurer, développer et pérenniser les projets : conseil, formation, mise en relation, événements et accès à des opportunités en Algérie et à l’international.',
    tags: ['Conseil', 'Formation', 'Accompagnement'],
    photo: VENUE_PHOTOS.grandeSalle,
    icon: BarChart3,
  },
];

const DIFFERENTIATORS = [
  'Un positionnement hybride : coworking, services, accompagnement et communauté réunis dans un seul modèle cohérent.',
  'Un adossement à La Maison IN Groupe, qui apporte des ressources, des filiales et un réseau d’experts.',
  'Une vision nationale dès le départ : chaque membre intègre un réseau, pas seulement un espace.',
];

const MISSION = [
  'Faciliter l’implantation et le développement des entreprises.',
  'Accompagner les entrepreneurs dans leurs démarches de structuration.',
  'Connecter les professionnels, les partenaires et les porteurs de projets.',
  'Favoriser les synergies et les collaborations durables.',
  'Faciliter les échanges entre l’Algérie et la diaspora algérienne.',
];

const JOURNEY = [
  { title: 'Comprendre', description: 'Identifier le projet, le besoin et le contexte du client. Premier échange structuré pour poser les bonnes bases.' },
  { title: 'Orienter', description: 'Définir le service ou l’offre la plus adaptée. Présentation claire des options disponibles et des complémentarités.' },
  { title: 'Structurer', description: 'Préciser les modalités, les documents requis et les prochaines étapes. Formalisation du parcours convenu.' },
  { title: 'Accompagner', description: 'Assurer le suivi dans le périmètre défini. Coordination avec les organismes et les partenaires concernés.' },
  { title: 'Connecter', description: 'Proposer, lorsque pertinent, des interlocuteurs ou expertises complémentaires au sein du réseau du groupe.' },
];

const COMMUNITY = [
  'Entrepreneurs en création',
  'Freelances et indépendants',
  'Startups en phase d’accélération',
  'PME en structuration',
  'Experts et prestataires référencés',
  'Partenaires institutionnels',
  'Membres de la diaspora algérienne',
];

// La Maison IN Groupe — filiales et expertises (proposition de l'audit du site).
// Sites des filiales déjà en ligne fournis le 27/10/2026 (IN ACADEMY, IN BEAUTY &
// HEALTH, IN DENTAL CARE, IN DEV) ; les autres et les logos officiels (fichier
// dans public/, ex. '/filiales/in-com.svg') restent à fournir (tâche 3.20).
// Tant que `logo` est vide, l'icône générique s'affiche ; avec `url`, la carte devient un lien.
/** Page « toutes les filiales » de la maquette (bouton masqué tant qu'elle n'est pas fournie). */
const GROUP_SITE_URL: string | null = null;

const GROUP_BRANDS: { name: string; role: string; icon: typeof Users2; logo?: string; url?: string }[] = [
  { name: 'IN CAPITAL', role: 'Finance & investissement', icon: BarChart3 },
  { name: 'IN DEV', role: 'Développement digital', icon: Code2, url: 'https://www.indevtech.dev/' },
  { name: 'IN COM', role: 'Communication 360°', icon: Megaphone },
  { name: 'IN NETWORK', role: 'Coworking & incubation', icon: Network },
  { name: 'IN ACADEMY', role: 'Formation certifiée', icon: GraduationCap, url: 'https://in-academy.dz/' },
  { name: 'IN DENTAL CARE', role: 'Soins dentaires', icon: Smile, url: 'https://in-dentalcare.dz/' },
  { name: 'IN BEAUTY & HEALTH', role: 'Beauté & bien-être', icon: Flower2, url: 'https://imh.dz/' },
  { name: 'IN CUBATOR', role: 'Incubation & startups', icon: Rocket },
  { name: 'IN ARTS', role: 'Art & culture', icon: Palette },
  { name: 'IN TEXTILE', role: 'Couture & broderie', icon: Shirt },
];

export default function AProposPage() {
  return (
    <>
      <section className="relative -mt-24 overflow-hidden md:-mt-28">
        <div className="mx-auto max-w-[74rem] px-4 pb-16 pt-32 md:pt-36">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-brand-orange" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">À propos</p>
              </div>
              <h1 className="mt-6 font-heading text-[clamp(2.4rem,4.6vw,3.6rem)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink-900">
                Faire grandir les entreprises par la force du <span className="text-brand-orange">réseau.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-600">
                Née à Hydra, Alger, IN NETWORK associe un lieu de travail, une communauté professionnelle et des services pour accompagner les ambitions entrepreneuriales.
              </p>
              <ul className="mt-10 grid gap-6 sm:grid-cols-3">
                {PILLARS.map((pillar) => (
                  <li key={pillar.title} className="border-ink-900/10 sm:border-l sm:pl-5 first:sm:border-l-0 first:sm:pl-0">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                      <pillar.icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <p className="mt-3 font-heading text-base font-bold text-ink-900">{pillar.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">{pillar.text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-soft-lg sm:aspect-[4/3] lg:aspect-[4/5]">
              <Image src={VENUE_PHOTOS.postes.src} alt={VENUE_PHOTOS.postes.alt} fill priority sizes="(min-width: 1024px) 480px, 100vw" className="object-cover" />
            </div>
          </div>

          <div className="mt-14 grid gap-6 rounded-[2rem] border border-ink-900/8 bg-white p-6 shadow-soft md:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-orange">Notre ambition</p>
              <p className="mt-3 font-heading text-[clamp(1.4rem,2.4vw,1.9rem)] font-bold leading-snug text-ink-900">
                Créer les conditions des rencontres qui deviennent des <span className="text-brand-orange">collaborations</span>, et des collaborations qui font avancer les projets.
              </p>
            </div>
            <p className="border-ink-900/10 text-ink-600 lg:border-l lg:pl-8">
              IN NETWORK est plus qu’un espace de coworking : c’est un écosystème où entrepreneurs, freelances, startups, entreprises, experts et partenaires se rencontrent, partagent leurs expériences et construisent ensemble des opportunités concrètes.
            </p>
          </div>

          <ScrollReveal stagger={90} className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['+250', 'entreprises nous ont déjà fait confiance'],
              ['+20', 'startups accompagnées'],
              ['Hydra', 'site pilote, au cœur d’Alger'],
            ].map(([figure, label]) => (
              <div key={figure} className="rounded-3xl border border-ink-900/8 bg-white/70 p-6">
                <p className="font-heading text-3xl font-bold text-ink-900">{figure}</p>
                <p className="mt-1 text-sm text-ink-500">{label}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Vision — bandeau bleu nuit de la charte */}
      <section className="relative overflow-hidden bg-ink-900 py-20 text-white md:py-28">
        <BrandTexture />
        <NetworkMotif tone="white" variant="sparse" className="pointer-events-none absolute -right-16 -top-16 h-[380px] w-[480px] opacity-30" />
        <Container className="relative max-w-4xl">
          <span className="eyebrow-light mb-6">Notre vision</span>
          <blockquote className="flex gap-5">
            <Quote className="mt-1 h-9 w-9 shrink-0 text-brand-orange" strokeWidth={2} />
            <p className="font-heading text-[clamp(1.6rem,3.4vw,2.6rem)] font-medium leading-snug text-white">
              Une idée devient un projet, un projet devient une entreprise, et une entreprise grandit grâce à{' '}
              <span className="italic text-brand-orange">la force du réseau.</span>
            </p>
          </blockquote>
          <p className="mt-8 pl-14 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">IN NETWORK, plus qu’un espace, une dynamique</p>
        </Container>
      </section>

      <section className="section-tint">
        <Container className="section-padding max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <div>
              <span className="eyebrow mb-3">Notre vision</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-5xl">
                Trois horizons, <span className="text-brand-orange">une ambition commune.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-ink-600">
                Créer un écosystème entrepreneurial de référence en Afrique du Nord et au-delà, où les talents, les idées et les entreprises se rencontrent, se développent et génèrent un impact durable.
              </p>
            </div>
            <p className="flex gap-3 border-l-2 border-brand-orange/40 pl-5 font-heading text-lg leading-snug text-ink-800">
              Des espaces, des compétences et des connexions pour transformer les ambitions en opportunités concrètes.
            </p>
          </div>
          <ScrollReveal stagger={90} className="mt-12 grid gap-5 md:grid-cols-3">
            {HORIZONS.map((horizon) => (
              <article key={horizon.n} className="flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-soft">
                <div className="relative aspect-[16/9]">
                  <Image src={horizon.photo.src} alt={horizon.photo.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-ink-900/80 via-ink-900/10 to-transparent" />
                  <p className="absolute bottom-4 left-5 flex items-end gap-3 text-white">
                    <span className="font-heading text-5xl font-light leading-none">{horizon.n}</span>
                    <span className="pb-1 text-xs font-semibold uppercase tracking-[0.18em]">{horizon.kicker}</span>
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <p className="flex items-center gap-3 font-heading text-lg font-bold text-ink-900">
                    <horizon.icon className="h-5 w-5 shrink-0 text-brand-orange" /> {horizon.title}
                  </p>
                  <p className="text-sm leading-relaxed text-ink-500">{horizon.text}</p>
                  <p className="mt-auto border-t border-ink-900/8 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{horizon.tags.join(' · ')}</p>
                </div>
              </article>
            ))}
          </ScrollReveal>
          <div className="relative mt-10 flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-ink-900 p-6 text-white md:flex-row md:items-center md:gap-10 md:p-8">
            <BrandTexture />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60 md:w-48">Notre conviction pour demain</p>
            <p className="flex-1 font-heading text-[clamp(1.25rem,2.4vw,1.75rem)] leading-snug">
              « Des talents connectés créent des entreprises plus fortes et un <span className="text-brand-orange">impact durable.</span> »
            </p>
          </div>
        </Container>
      </section>

      <Container className="section-padding max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="eyebrow mb-3">Notre communauté</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">Seul, on avance. Ensemble, on va plus loin.</h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              La communauté IN NETWORK rassemble des entrepreneurs, des freelances, des startups, des PME, des experts et des partenaires institutionnels. Elle produit des connexions, des recommandations, des collaborations et des opportunités commerciales croisées.
            </p>
            <p className="mt-3 font-semibold text-ink-900">Ce n&apos;est pas un réseau de cartes de visite. C&apos;est un réseau de confiance.</p>
            <ul className="mt-8 space-y-3">
              {DIFFERENTIATORS.map((text, index) => (
                <li key={text} className="flex gap-4">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 font-heading text-sm font-bold text-brand-orange">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-ink-700">{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <Card accent="ink" className="self-start">
            <CardContent>
              <p className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <Users2 className="h-4 w-4 text-brand-orange" /> Un réseau en construction permanente
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-600">
                {COMMUNITY.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Network className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-500">La puissance du réseau vient de la diversité et de la complémentarité de ses membres.</p>
            </CardContent>
          </Card>
        </div>
      </Container>

      <section className="section-tint">
        <Container className="section-padding max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <span className="eyebrow mb-3">Notre mission</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
                Faciliter l&apos;implantation, la structuration et le <span className="text-brand-orange">développement</span>
              </h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                Construire un écosystème professionnel où les entreprises peuvent se structurer, se connecter et saisir de nouvelles opportunités — en Algérie et au-delà.
              </p>
              <ul className="mt-5 space-y-2.5 text-ink-700">
                {MISSION.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <Compass className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="eyebrow mb-3">Notre parcours d&apos;accompagnement</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">Cinq étapes, un interlocuteur unique</h2>
              <ol className="mt-6 space-y-4">
                {JOURNEY.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 font-heading text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-heading text-base font-bold text-ink-900">{step.title}</p>
                      <p className="text-sm leading-relaxed text-ink-500">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </section>

      <section className="relative overflow-hidden">
        <Container className="section-padding max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-center">
            <div>
              <span className="eyebrow mb-3">La Maison IN Groupe</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-5xl">
                Un écosystème. Dix expertises. <span className="text-brand-orange">Une même ambition.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-ink-600">
                Des expertises complémentaires pour accompagner les entreprises à chaque étape de leur développement. IN NETWORK oriente chaque membre vers la filiale adaptée ; chaque prestation est réalisée et facturée par la filiale compétente, selon ses propres conditions.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 lg:justify-end">
              <span className="h-px w-12 bg-ink-900/20" />
              <p className="text-center font-heading text-ink-900">
                <span className="block text-xs font-semibold tracking-[0.4em]">LA MAISON</span>
                <span className="block text-5xl font-extrabold leading-none">IN</span>
                <span className="block text-xs font-semibold tracking-[0.4em]">GROUPE</span>
              </p>
              <span className="h-px w-12 bg-ink-900/20" />
            </div>
          </div>
          <ScrollReveal stagger={50} className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {GROUP_BRANDS.map((brand) => {
              const body = (
                <>
                  {brand.logo ? (
                    <span className="relative flex h-10 w-24 items-center">
                      <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="96px" className="object-contain object-left" />
                    </span>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
                      <brand.icon className="h-4 w-4" />
                    </span>
                  )}
                  <span aria-hidden className="h-0.5 w-6 rounded-full bg-brand-orange" />
                  <p className="font-heading text-sm font-bold text-ink-900">{brand.name}</p>
                  <p className="-mt-2 text-xs text-ink-500">{brand.role}</p>
                  {brand.url && (
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-brand-orange">
                      Visiter le site <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </>
              );
              const cardClass = cn('flex h-full flex-col gap-3 rounded-2xl border bg-white p-5 shadow-soft', brand.name === 'IN NETWORK' ? 'border-brand-orange/40 ring-1 ring-brand-orange/20' : 'border-ink-900/8');
              return brand.url ? (
                <a key={brand.name} href={brand.url} target="_blank" rel="noopener noreferrer" className={cn(cardClass, 'transition hover:-translate-y-0.5 hover:border-ink-900/25')}>
                  {body}
                </a>
              ) : (
                <div key={brand.name} className={cardClass}>
                  {body}
                </div>
              );
            })}
          </ScrollReveal>
          {GROUP_SITE_URL && (
            <div className="mt-8 flex justify-center">
              <a href={GROUP_SITE_URL} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'gap-2')}>
                Découvrir toutes les filiales <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </Container>
      </section>

      <section className="relative overflow-hidden bg-ink-900 text-white">
        <BrandTexture />
        <NetworkMotif tone="white" variant="default" className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[520px] opacity-40" />
        <Container className="section-padding relative flex flex-col items-center gap-5 text-center">
          <p className="eyebrow-light justify-center">Notre engagement</p>
          <h2 className="max-w-2xl font-heading text-3xl font-bold text-white md:text-4xl">
            Construire ensemble ce que <span className="text-brand-orange">nul ne peut construire seul.</span>
          </h2>
          <p className="max-w-2xl text-white/75">
            Chaque entrepreneur, quelle que soit son étape, trouve chez IN NETWORK l&apos;espace pour travailler, les ressources pour structurer son activité et le réseau pour accélérer sa croissance.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              Rejoindre le réseau
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: 'outline-light', size: 'lg' }))}>
              Nous contacter
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
