import Link from 'next/link';
import {
  Building2,
  Compass,
  FileCheck2,
  Globe2,
  Handshake,
  LifeBuoy,
  MapPin,
  Network,
  Quote,
  Rocket,
  Sparkles,
  Users2,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { NetworkMotif } from '@/components/ui/network-motif';
import { BrandTexture } from '@/components/ui/brand-texture';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'À propos — présentation d’IN NETWORK',
  description:
    'IN NETWORK, infrastructure entrepreneuriale hybride à Hydra, Alger : espaces de travail, services intégrés, accompagnement structuré et communauté active. La Maison IN Groupe.',
};

// Présentation de l'entreprise : reprend, section par section, le document
// « À propos de IN NETWORK » (présentation projet) fourni par le client, complété
// par les chiffres clés et le parcours d'accompagnement du catalogue des services.

const LEVERS = [
  { icon: Building2, title: 'Travailler', description: 'Des espaces flexibles, des bureaux privatifs et des infrastructures adaptées aux nouvelles formes de travail.' },
  { icon: FileCheck2, title: 'Structurer', description: 'Domiciliation, création d’entreprise, assistance administrative : les fondations de chaque projet.' },
  { icon: LifeBuoy, title: 'Accompagner', description: 'Un accès direct à des expertises en comptabilité, droit, marketing, communication et stratégie.' },
  { icon: Handshake, title: 'Connecter', description: 'Une communauté entrepreneuriale vivante, fondée sur le partage, l’entraide et les synergies.' },
  { icon: Rocket, title: 'Accélérer', description: 'Un environnement dédié à l’incubation et à l’accélération des startups et PME digitales.' },
];

const DIFFERENTIATORS = [
  'Un positionnement hybride unique en Algérie : coworking, services, accompagnement et communauté dans un seul modèle cohérent.',
  'Un adossement à La Maison IN Groupe, qui apporte des ressources, des filiales et un réseau d’experts que les espaces indépendants ne peuvent pas offrir.',
  'Un modèle à revenus multiples qui garantit la durabilité du projet et la qualité de l’expérience membre.',
  'Une vision nationale dès le départ : chaque membre intègre un réseau, pas seulement un espace.',
];

const OBJECTIVES = [
  {
    icon: MapPin,
    label: 'À court terme',
    title: 'Faire référence à Hydra',
    points: [
      'Faire du site pilote de Hydra la référence entrepreneuriale d’Alger.',
      'Constituer une communauté active de 100+ membres.',
      'Valider un modèle économique hybride et documenté.',
    ],
  },
  {
    icon: Sparkles,
    label: 'À moyen terme',
    title: 'Un réseau national',
    points: [
      'Déployer un réseau national : Alger, Oran, Constantine, Annaba et le Sud.',
      'Lancer la plateforme digitale de matching membres-experts.',
      'Fédérer 500+ entrepreneurs, startups et PME connectés.',
    ],
  },
  {
    icon: Globe2,
    label: 'À long terme',
    title: 'Rayonner en Afrique du Nord',
    points: [
      'Devenir le premier réseau entrepreneurial intelligent d’Afrique du Nord.',
      'Connecter la diaspora algérienne aux opportunités locales.',
      'Étendre vers la région MENA.',
    ],
  },
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

const GROUP_BRANDS = [
  { name: 'IN COM', role: 'Communication digitale, réseaux sociaux, branding et contenu' },
  { name: 'IN Academy', role: 'Formation professionnelle et développement des compétences' },
  { name: 'IN DEV', role: 'Développement web, mobile, CRM et solutions digitales' },
  { name: 'IN-CUBATOR', role: 'Incubation et accélération de startups' },
];

// « Notre valeur ajoutée » (catalogue des services, §08).
const VALUE_POINTS = [
  { title: 'Approche centrée sur les besoins', text: 'Chaque service est activé selon le besoin réel identifié — pas de package standardisé imposé.' },
  { title: 'Portes d’entrée multiples', text: 'Quelle que soit la demande initiale (bureau, domiciliation, création, réseau), elle ouvre l’accès à l’ensemble de l’écosystème.' },
  { title: 'Complémentarité du groupe', text: 'Un seul groupe, plusieurs expertises : IN NETWORK oriente vers IN COM, IN Academy, IN DEV, IN-CUBATOR selon les besoins.' },
  { title: 'Réseau actif et qualitatif', text: 'Une communauté d’entrepreneurs, d’experts et de partenaires qui génère des connexions utiles et des opportunités réelles.' },
  { title: 'Lisibilité du parcours entrepreneurial', text: 'IN NETWORK simplifie un parcours souvent dispersé : un environnement structuré et un interlocuteur de référence.' },
  { title: 'Relation évolutive', text: 'L’accompagnement s’adapte à l’évolution du client : de la création à la croissance, IN NETWORK reste un partenaire de référence.' },
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

export default function AProposPage() {
  return (
    <>
      <Container className="section-padding max-w-4xl">
        <PageHeader
          eyebrow="À propos · IN NETWORK"
          title={
            <>
              Le coworking nous rassemble. Le <span className="text-brand-orange">réseau</span> nous fait grandir.
            </>
          }
          description="Un écosystème entrepreneurial qui connecte les talents, les expertises et les opportunités. La Maison IN Groupe · Hydra, Alger."
        />

        <div className="space-y-5 text-ink-600 sm:max-w-3xl">
          <h2 className="font-heading text-2xl font-bold text-ink-900 md:text-3xl">Bien plus qu&apos;un espace. Un écosystème.</h2>
          <p>
            IN NETWORK est une infrastructure entrepreneuriale hybride. Nous combinons des espaces de travail
            professionnels, des services intégrés, un accompagnement structuré et une communauté active
            d&apos;entrepreneurs, de freelances et d&apos;entreprises.
          </p>
          <p className="font-semibold text-ink-900">Notre raison d&apos;être : transformer chaque connexion en opportunité réelle.</p>
        </div>

        <ScrollReveal stagger={90} className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['+250', 'entreprises nous ont déjà fait confiance'],
            ['+20', 'startups accompagnées'],
            ['Hydra', 'site pilote, au cœur d’Alger'],
          ].map(([figure, label]) => (
            <div key={figure} className="rounded-3xl border border-ink-900/8 bg-white p-6 shadow-soft">
              <p className="font-heading text-4xl font-bold text-ink-900">{figure}</p>
              <p className="mt-1 text-sm text-ink-500">{label}</p>
            </div>
          ))}
        </ScrollReveal>
      </Container>

      {/* Vision — bandeau violet de la charte */}
      <section className="relative overflow-hidden bg-ink-900 py-20 text-white md:py-28">
        <BrandTexture />
        <NetworkMotif tone="white" variant="sparse" className="pointer-events-none absolute -right-16 -top-16 h-[380px] w-[480px] opacity-30" />
        <Container className="relative max-w-3xl">
          <span className="eyebrow-light mb-5">Notre vision</span>
          <Quote className="h-8 w-8 text-accent-yellow" strokeWidth={2} />
          <p className="mt-5 font-heading text-2xl font-medium leading-snug text-white md:text-3xl">Connecter pour faire grandir.</p>
          <p className="mt-5 text-lg leading-relaxed text-white/80">
            Nous croyons que l&apos;entrepreneur algérien mérite plus qu&apos;un bureau. Il mérite un environnement où
            les ressources sont accessibles, les expertises sont proches, et les connexions humaines créent de la valeur.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            Notre vision : bâtir le premier réseau entrepreneurial intelligent d&apos;Algérie — ancré localement,
            connecté nationalement, ouvert sur le monde.
          </p>
        </Container>
      </section>

      <Container className="section-padding max-w-5xl">
        <div className="mb-10">
          <span className="eyebrow mb-3">L&apos;écosystème IN NETWORK</span>
          <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Cinq leviers, une <span className="text-brand-orange">dynamique intégrée</span>
          </h2>
        </div>
        {/* Un seul tableau d'enfants : ScrollReveal décale chaque enfant direct (cf. scroll-motion.tsx). */}
        <ScrollReveal stagger={80} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ...LEVERS.map((lever) => (
              <Card key={lever.title} accent="orange" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-orange/10 text-brand-orange">
                    <lever.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-ink-900">{lever.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-500">{lever.description}</p>
                </CardContent>
              </Card>
            )),
            <div key="portes" className="flex h-full items-center rounded-3xl bg-ink-900 p-6 text-white">
              <p className="font-heading text-lg font-semibold leading-snug">
                Les services sont les portes d&apos;entrée. <span className="text-accent-yellow">La communauté est la force.</span>
              </p>
            </div>,
          ]}
        </ScrollReveal>
      </Container>

      <section className="section-tint">
        <Container className="section-padding max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <span className="eyebrow mb-3">Nos services</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">Ce que vous trouvez ici.</h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                Un espace de coworking ouvert et flexible, des bureaux privatifs pour les équipes en structuration,
                une salle de réunion disponible 24h/24, un service de domiciliation juridique et fiscale activable
                en 48 h, un accompagnement complet pour la création d&apos;entreprise, et un accès structuré aux experts
                du groupe.
              </p>
              <p className="mt-3 font-semibold text-ink-900">Chaque service est une porte d&apos;entrée vers l&apos;écosystème — pas une finalité.</p>
              <Link href="/services" className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'mt-6')}>
                Découvrir les services & tarifs
              </Link>
            </div>
            <div>
              <span className="eyebrow mb-3">Notre valeur ajoutée</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">Ce que vous ne trouvez pas ailleurs.</h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                IN NETWORK réunit dans un même lieu ce que l&apos;entrepreneur doit habituellement chercher séparément :
                un espace crédible, des services administratifs, des expertises complémentaires et un réseau actif.
              </p>
              <p className="mt-3 leading-relaxed text-ink-600">
                Nous ne proposons pas des bureaux. Nous proposons un environnement qui structure, professionnalise et connecte.
              </p>
              <p className="mt-3 font-semibold text-ink-900">
                La valeur d&apos;IN NETWORK augmente à mesure que le réseau grandit : plus la communauté est dense, plus chaque membre en bénéficie.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Container className="section-padding max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="eyebrow mb-3">Notre communauté</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">Seul, on avance. Ensemble, on va plus loin.</h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              La communauté IN NETWORK rassemble des entrepreneurs, des freelances, des startups, des PME, des experts et
              des partenaires institutionnels. Elle produit des connexions, des recommandations, des collaborations et des
              opportunités commerciales croisées.
            </p>
            <p className="mt-3 font-semibold text-ink-900">Ce n&apos;est pas un réseau de cartes de visite. C&apos;est un réseau de confiance.</p>
            <p className="mt-3 leading-relaxed text-ink-600">
              Notre force : la densité et la qualité des relations construites au sein de l&apos;écosystème. Nos partenariats
              couvrent les domaines juridique, comptable, financier, formation, incubation et communication — pour que chaque
              membre trouve au sein du réseau les ressources dont il a besoin.
            </p>
          </div>
          <Card accent="violet" className="self-start">
            <CardContent>
              <p className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <Users2 className="h-4 w-4 text-violet-700" /> Un réseau en construction permanente
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-600">
                {COMMUNITY.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Network className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
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
          <div className="mb-10">
            <span className="eyebrow mb-3">Ce qui nous distingue</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
              Nos avantages <span className="text-brand-orange">différenciants</span>
            </h2>
          </div>
          <ScrollReveal stagger={80} className="grid gap-4 md:grid-cols-2">
            {DIFFERENTIATORS.map((text, index) => (
              <div key={text} className="flex gap-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-900/6">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 font-heading text-sm font-bold text-brand-orange">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-700">{text}</p>
              </div>
            ))}
          </ScrollReveal>
        </Container>
      </section>

      <Container className="section-padding max-w-5xl">
        <div className="mb-10">
          <span className="eyebrow mb-3">Notre valeur ajoutée</span>
          <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Six raisons de <span className="text-brand-orange">nous choisir</span>
          </h2>
        </div>
        <ScrollReveal stagger={70} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {VALUE_POINTS.map((point) => (
            <div key={point.title} className="h-full rounded-3xl border border-ink-900/8 bg-white p-5 shadow-soft">
              <p className="font-heading text-base font-bold text-ink-900">{point.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{point.text}</p>
            </div>
          ))}
        </ScrollReveal>
      </Container>

      <Container className="section-padding max-w-5xl pt-0">
        <div className="mb-10">
          <span className="eyebrow mb-3">Nos objectifs</span>
          <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Là où nous <span className="text-brand-orange">allons</span>
          </h2>
        </div>
        <ScrollReveal stagger={100} className="grid gap-5 md:grid-cols-3">
          {OBJECTIVES.map((objective) => (
            <Card key={objective.title} accent="orange" className="h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-orange/10 text-brand-orange">
                  <objective.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{objective.label}</span>
                <h3 className="font-heading text-lg font-bold text-ink-900">{objective.title}</h3>
                <ul className="space-y-2 text-sm leading-relaxed text-ink-500">
                  {objective.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </ScrollReveal>
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
                Construire un écosystème professionnel où les entreprises peuvent se structurer, se connecter et saisir de
                nouvelles opportunités — en Algérie et au-delà.
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

      <Container className="section-padding max-w-5xl">
        <div className="mb-10">
          <span className="eyebrow mb-3">La Maison IN Groupe</span>
          <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Un seul point d&apos;entrée pour des expertises <span className="text-brand-orange">multiples</span>
          </h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            IN NETWORK joue le rôle de porte d&apos;entrée et de connecteur au sein du groupe : il oriente chaque membre vers
            les expertises adaptées. Chaque prestation est réalisée et facturée par la filiale compétente, selon ses propres
            conditions de service.
          </p>
        </div>
        <ScrollReveal stagger={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GROUP_BRANDS.map((brand) => (
            <div key={brand.name} className="rounded-3xl bg-white/60 p-1.5 ring-1 ring-ink-900/6">
              <div className="h-full rounded-[1.1rem] bg-white p-5">
                <p className="font-heading font-bold text-ink-900">{brand.name}</p>
                <p className="mt-1 text-sm text-ink-500">{brand.role}</p>
              </div>
            </div>
          ))}
        </ScrollReveal>
        <p className="mt-4 text-sm text-ink-500">Autres filiales du groupe : selon les besoins identifiés.</p>
      </Container>

      <section className="relative overflow-hidden bg-ink-900 text-white">
        <BrandTexture />
        <NetworkMotif tone="white" variant="default" className="pointer-events-none absolute -left-20 -bottom-20 h-[400px] w-[520px] opacity-40" />
        <Container className="section-padding relative flex flex-col items-center gap-5 text-center">
          <p className="eyebrow-light justify-center">Notre engagement</p>
          <h2 className="max-w-2xl font-heading text-3xl font-bold text-white md:text-4xl">
            Construire ensemble ce que <span className="text-accent-yellow">nul ne peut construire seul.</span>
          </h2>
          <p className="max-w-2xl text-white/75">
            IN NETWORK n&apos;est pas un fournisseur de services : c&apos;est un partenaire de développement. Chaque
            entrepreneur, quelle que soit son étape, y trouve l&apos;espace pour travailler, les ressources pour structurer son
            activité, et le réseau pour accélérer sa croissance. Connecter les ambitions. Multiplier les opportunités. Réussir collectivement.
          </p>
          <p className="font-heading text-lg font-semibold text-white">Rejoignez l&apos;écosystème. Construisons ensemble.</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              Devenir membre
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
