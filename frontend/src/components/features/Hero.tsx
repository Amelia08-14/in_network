import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';
import { NetworkMotif } from '@/components/ui/network-motif';
import { cn } from '@/lib/utils';

const STATS = [
  { value: '1er', label: 'réseau d’affaires à Hydra' },
  { value: '360°', label: 'coworking, réseau & services' },
  { value: '100 %', label: 'entrepreneurs, freelances & PME' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink-900">
      {/* Halo orange discret derrière le panneau réseau — seule touche de glow du site. */}
      <div className="pointer-events-none absolute right-[-10%] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-brand-orange/20 blur-[120px]" />

      <Container className="relative grid gap-14 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div className="flex max-w-xl flex-col items-start gap-6 motion-safe:animate-fade-in-up">
          <span className="eyebrow-light">Hydra, Alger — coworking &amp; réseau d&apos;affaires</span>

          <h1 className="font-heading text-4xl font-extrabold leading-[1.05] text-white md:text-6xl">
            Le <span className="text-brand-orange">réseau</span> qui fait avancer les entrepreneurs.
          </h1>

          <p className="text-lg leading-relaxed text-white/70">
            Espace de coworking, mise en réseau ciblée et services entrepreneuriaux
            réunis en un seul lieu — parce que la technologie doit suivre le réseau,
            pas le précéder.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              Devenir membre <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/annuaire"
              className={cn(buttonVariants({ variant: 'outline-light', size: 'lg' }))}
            >
              Découvrir l&apos;annuaire
            </Link>
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <dt className="font-heading text-2xl font-bold text-white">{stat.value}</dt>
                <dd className="text-sm text-white/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative hidden aspect-[4/3] items-center justify-center overflow-hidden rounded-card border border-white/10 bg-white/[0.03] backdrop-blur lg:flex">
          <NetworkMotif tone="white" className="h-full w-full p-8" />
          <div className="absolute left-6 top-6 rounded-pill border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Freelance ↔ Expert juridique
          </div>
          <div className="absolute bottom-8 right-8 rounded-pill border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            PME ↔ Comptabilité
          </div>
        </div>
      </Container>
    </section>
  );
}
