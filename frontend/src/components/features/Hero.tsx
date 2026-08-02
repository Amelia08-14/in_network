import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';
import { NetworkMotif } from '@/components/ui/network-motif';
import { BrandTexture } from '@/components/ui/brand-texture';
import { cn } from '@/lib/utils';

const STATS = [
  { value: '1er', label: 'réseau d’affaires à Hydra' },
  { value: '360°', label: 'coworking, réseau & services' },
  { value: '100 %', label: 'entrepreneurs, freelances & PME' },
];

// Composition "image-as-canvas" plein écran : le hero bleed sous la nav
// flottante (-mt compense le padding-top global de <main>), le NetworkMotif
// occupe tout l'arrière-plan en plusieurs couches de profondeur, les stats
// sont des chips glass (double coque) plutôt qu'une simple ligne de texte.
export function Hero() {
  return (
    <section className="relative -mt-24 overflow-hidden bg-ink-900 md:-mt-28">
      <BrandTexture />
      <NetworkMotif
        tone="white"
        variant="dense"
        className="absolute inset-0 h-full w-full opacity-[0.14] motion-safe:animate-fade-in"
      />
      <NetworkMotif
        tone="white"
        variant="default"
        className="absolute -right-24 top-1/2 h-[560px] w-[720px] -translate-y-1/2 opacity-30"
      />
      <div className="pointer-events-none absolute right-[-10%] top-1/4 h-[520px] w-[520px] rounded-full bg-brand-orange/25 blur-[140px]" />
      <div className="pointer-events-none absolute left-[-12%] bottom-0 h-[380px] w-[380px] rounded-full bg-brand-blue/10 blur-[120px]" />
      {/* Accent géométrique — bande diagonale orange, seule touche graphique franche du hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-0 h-full w-[280px] origin-top-right skew-x-[-12deg] bg-gradient-to-b from-brand-orange/[0.07] via-brand-orange/[0.03] to-transparent"
      />

      <Container className="relative flex min-h-[92vh] flex-col justify-end gap-14 pb-16 pt-40 md:min-h-[95vh] md:pb-20 md:pt-48">
        <div className="flex max-w-3xl flex-col items-start gap-7 motion-safe:animate-fade-in-up">
          <span className="eyebrow-light">Hydra, Alger — coworking &amp; réseau d&apos;affaires</span>

          <h1 className="font-heading text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Le <span className="text-brand-orange">réseau</span> qui fait avancer les entrepreneurs.
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-white/70">
            Espace de coworking, mise en réseau ciblée et services entrepreneuriaux
            réunis en un seul lieu — parce que la technologie doit suivre le réseau,
            pas le précéder.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'group')}>
              Devenir membre
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
            <Link
              href="/annuaire"
              className={cn(buttonVariants({ variant: 'outline-light', size: 'lg' }))}
            >
              Découvrir l&apos;annuaire
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-[1.5rem] bg-white/[0.06] p-1.5 ring-1 ring-white/10">
              <div className="flex items-baseline gap-2 rounded-[1.1rem] bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
                <dt className="font-heading text-3xl font-bold text-white">{stat.value}</dt>
                <dd className="text-sm text-white/60">{stat.label}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
