import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroScrollCue } from '@/components/features/HeroScrollCue';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';

// Hero — panneau visuel : la vidéo « network hero » (carte 3D de l'Algérie +
// pin IN NETWORK), fournie par la cliente. Elle est encodée sur fond blanc :
// `mix-blend-mode: darken` fait disparaître ce blanc dans le fond paper du
// hero, la carte crème reste posée « en relief » sans cadre ni panneau
// (demande cliente : « sans arrière plan »). HeroScrollCue = repère de scroll
// centré en bas.
export function Hero() {
  return (
    <section className="relative isolate -mt-24 flex items-center overflow-x-clip bg-brand-paper md:-mt-28 lg:min-h-screen">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15,27,46,0.07) 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />
      <div
        aria-hidden
        className="absolute -left-48 top-24 h-[480px] w-[480px] rounded-full bg-brand-orange/[0.06] blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -right-40 bottom-0 h-[560px] w-[560px] rounded-full bg-ink-900/[0.05] blur-3xl"
      />

      <div className="relative mx-auto grid w-full max-w-[1360px] grid-cols-1 items-center gap-8 px-6 pb-28 pt-32 md:pb-20 md:pt-40 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:px-12">
        <div className="max-w-[640px]">
          <div className="hero-in flex items-center gap-3">
            <span className="h-px w-10 bg-brand-orange" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">
              Le réseau entrepreneurial algérien
            </p>
          </div>

          <h1 className="hero-in hero-d1 mt-7 font-heading text-[clamp(2.5rem,5.2vw,4.25rem)] font-extrabold leading-[1.03] tracking-[-0.04em] text-ink-900">
            Les bonnes connexions
            <br />
            font avancer les
            <br />
            <span className="text-brand-orange">bonnes entreprises.</span>
          </h1>

          <p className="hero-in hero-d2 mt-8 max-w-[540px] text-base leading-8 text-ink-600 md:text-lg">
            IN NETWORK réunit entrepreneurs, experts, partenaires et opportunités professionnelles
            au sein d&apos;un réseau structuré, accessible et ancré en Algérie.
          </p>

          <div className="hero-in hero-d3 mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand-orange px-8 text-sm font-semibold text-white shadow-[0_16px_38px_-12px_rgba(212,72,53,0.5)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-orange/90"
            >
              Rejoindre le réseau
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/inscription-entreprise"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-ink-900/15 bg-white/60 px-8 text-sm font-semibold text-ink-900 backdrop-blur-sm transition duration-300 hover:border-ink-900 hover:bg-white"
            >
              Inscrire mon entreprise
            </Link>
          </div>

          <dl className="hero-in hero-d3 mt-10 grid grid-cols-3 gap-3 border-t border-ink-900/10 pt-6 sm:gap-5">
            {[
              ['Entreprises', 'freelances & PME'],
              ['Experts', 'juridique & compta'],
              ['Partenaires', 'institutions & réseaux'],
            ].map(([term, desc]) => (
              <div key={term}>
                <dt className="font-heading text-sm font-bold text-ink-900">{term}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-ink-500">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hero-in hero-d2 relative mx-auto w-full max-w-[620px]">
          <div className="hero-float relative aspect-square">
            <MotionSafeVideo
              src="/network-hero.mp4"
              className="absolute inset-0 h-full w-full scale-[1.18] object-contain mix-blend-darken"
              showControlsOnReducedMotion={false}
              aria-label="Carte animée de l'Algérie avec le réseau IN NETWORK"
            />
          </div>

          <div className="hero-in hero-d3 absolute left-0 top-10 hidden rounded-2xl border border-ink-900/10 bg-white/85 px-4 py-3 shadow-soft-lg backdrop-blur-sm sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Mise en relation</p>
            <p className="mt-0.5 text-sm font-semibold text-ink-900">Freelance ↔ Expert juridique</p>
          </div>
          <div className="hero-in hero-d3 absolute bottom-12 right-0 hidden rounded-2xl border border-ink-900/10 bg-white/85 px-4 py-3 shadow-soft-lg backdrop-blur-sm sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Réseau national</p>
            <p className="mt-0.5 text-sm font-semibold text-ink-900">PME ↔ Comptabilité</p>
          </div>
        </div>
      </div>

      <HeroScrollCue />

      <style>{`
        .hero-in { opacity: 0; transform: translateY(24px); animation: hero-in 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .hero-d1 { animation-delay: 90ms; }
        .hero-d2 { animation-delay: 180ms; }
        .hero-d3 { animation-delay: 300ms; }
        .hero-float { animation: hero-float 7s ease-in-out infinite; }
        .hero-scroll-dot { animation: hero-scroll-dot 1.8s ease-in-out infinite; }
        @keyframes hero-in { to { opacity: 1; transform: translateY(0); } }
        @keyframes hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes hero-scroll-dot {
          0% { opacity: 0; transform: translateY(0); }
          25% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translateY(12px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-in, .hero-float, .hero-scroll-dot { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
}
