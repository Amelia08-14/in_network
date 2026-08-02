import Link from 'next/link';
import { Quote, MapPin, Globe2, Sparkles } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { NetworkMotif } from '@/components/ui/network-motif';
import { BrandTexture } from '@/components/ui/brand-texture';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'À propos' };

const HORIZONS = [
  {
    icon: MapPin,
    label: '18 premiers mois',
    title: 'Faire référence à Hydra',
    description:
      "Remplir notre premier lieu de membres actifs, prouver que le modèle génère de la valeur et documenter ce qui marche. Objectif : 100 membres, un lieu rentable.",
  },
  {
    icon: Sparkles,
    label: '18 mois à 3 ans',
    title: 'Un réseau national',
    description:
      'Ouvrir de nouveaux lieux à Alger, Oran, Constantine, Annaba et dans le Sud, connectés par une même plateforme digitale. Objectif : 5 lieux, 500 membres.',
  },
  {
    icon: Globe2,
    label: '3 à 7 ans',
    title: "Rayonner sur l'Afrique du Nord",
    description:
      "Devenir le plus grand réseau d'entrepreneurs d'Afrique du Nord, connecter la diaspora algérienne au marché local, puis s'étendre dans la région MENA.",
  },
];

const GROUP_BRANDS = [
  { name: 'IN ACADEMY', role: 'Formation professionnelle' },
  { name: 'IN DEV', role: 'Développement digital' },
  { name: 'IN COM', role: 'Communication & marketing' },
  { name: 'IN IMMO', role: 'Immobilier & aménagement' },
  { name: 'IN TRAVEL', role: 'Voyage & déplacements' },
  { name: 'IN PAY', role: 'Solutions de paiement' },
];

export default function AProposPage() {
  return (
    <>
      <Container className="section-padding max-w-4xl">
        <PageHeader
          eyebrow="À propos"
          title={
            <>
              La technologie suit le <span className="text-brand-orange">réseau</span>, elle ne le précède pas.
            </>
          }
          description="IN NETWORK est né à Hydra, Alger, avec une conviction simple : les entrepreneurs, freelances et PME avancent plus vite lorsqu'ils sont bien entourés."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-4 text-ink-600 sm:col-span-2 sm:max-w-2xl">
            <p>
              Avant d&apos;être une plateforme, IN NETWORK est d&apos;abord un lieu — un espace de coworking
              pensé pour la rencontre autant que pour la productivité. Notre réseau réunit des profils
              complémentaires : freelances, startups, PME, membres de la diaspora, experts et partenaires.
            </p>
            <p>
              Notre rôle est de faciliter ces rencontres, à travers un annuaire ciblé et un moteur de mise
              en relation qui s&apos;améliore avec le temps — parce qu&apos;en Algérie, trop d&apos;entrepreneurs
              avancent seuls, sans lieu professionnel crédible ni réseau pour trouver clients et partenaires.
            </p>
          </div>
        </div>
      </Container>

      {/* Panneau mission — remplace un visuel photo (aucune photo réelle du lieu disponible pour l'instant) */}
      <section className="relative overflow-hidden bg-ink-900 py-20 text-white md:py-28">
        <BrandTexture />
        <NetworkMotif tone="white" variant="sparse" className="pointer-events-none absolute -right-16 -top-16 h-[380px] w-[480px] opacity-30" />
        <Container className="relative max-w-3xl">
          <Quote className="h-8 w-8 text-brand-orange" strokeWidth={2} />
          <p className="mt-5 font-heading text-2xl font-medium leading-snug text-white md:text-3xl">
            On entre avec une idée ou une activité isolée, on en ressort avec une entreprise structurée,
            connectée et en croissance.
          </p>
          <p className="mt-4 text-sm text-white/60">L&apos;essentiel du projet IN NETWORK, en une phrase.</p>
        </Container>
      </section>

      <Container className="section-padding max-w-5xl">
        <div className="mb-10">
          <span className="eyebrow mb-3">Notre vision</span>
          <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Trois horizons, une <span className="text-brand-orange">ambition</span>
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {HORIZONS.map((horizon) => (
            <Card key={horizon.title} accent="orange" className="h-full">
              <CardContent className="flex h-full flex-col gap-3 pl-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-orange/10 text-brand-orange">
                  <horizon.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{horizon.label}</span>
                <h3 className="font-heading text-lg font-bold text-ink-900">{horizon.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{horizon.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>

      <section className="section-tint">
        <Container className="section-padding max-w-5xl">
          <div className="mb-10">
            <span className="eyebrow mb-3">La Maison IN Groupe</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
              IN NETWORK fait partie d&apos;un <span className="text-brand-orange">groupe</span>
            </h2>
            <p className="mt-2 max-w-2xl text-ink-500">
              Un membre IN NETWORK peut, à terme, accéder à l&apos;ensemble des services du groupe depuis un
              seul endroit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GROUP_BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="rounded-[1.5rem] bg-white/60 p-1.5 ring-1 ring-ink-900/[0.06]"
              >
                <div className="rounded-[1.1rem] bg-white p-5">
                  <p className="font-heading font-bold text-ink-900">{brand.name}</p>
                  <p className="mt-1 text-sm text-ink-500">{brand.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="relative overflow-hidden bg-ink-900 text-white">
        <BrandTexture />
        <NetworkMotif tone="white" variant="default" className="pointer-events-none absolute -left-20 -bottom-20 h-[400px] w-[520px] opacity-40" />
        <Container className="section-padding relative flex flex-col items-center gap-5 text-center">
          <h2 className="max-w-xl font-heading text-3xl font-bold text-white md:text-4xl">
            Rejoins le <span className="text-brand-orange">réseau</span>
          </h2>
          <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
            Devenir membre
          </Link>
        </Container>
      </section>
    </>
  );
}
