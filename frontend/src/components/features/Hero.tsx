import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';

// Hero — panneau visuel : la vidéo « network hero » (carte 3D de l'Algérie +
// réseau de cartes Entrepreneurs/Experts/Partenaires/Coworking/Événements/
// Services), fournie par la cliente. Elle est encodée sur fond blanc :
// `mix-blend-mode: multiply` fait disparaître ce blanc dans le fond paper du
// hero (blanc × paper = paper), la composition reste posée sans cadre. Fond
// paper sur toute la section, comme le reste du site. Pas d'étiquette
// ajoutée par-dessus : la vidéo est déjà légendée. Le cadre source est carré
// avec ~10 % de blanc en haut/bas et ~7 % sur les côtés : on le recadre (6/5,
// `object-cover`) et on laisse la colonne déborder en desktop pour que la
// carte atteigne la hauteur du bloc de texte.
export function Hero() {
  return (
    <section className="relative isolate -mt-24 flex items-center overflow-x-clip bg-brand-paper md:-mt-28">
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

      <div className="relative mx-auto grid w-full max-w-[74rem] grid-cols-1 items-center gap-8 px-4 pb-6 pt-28 md:pt-32 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="max-w-[640px]">
          <div className="hero-in flex items-center gap-3">
            <span className="h-px w-10 bg-brand-orange" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">
              Le réseau entrepreneurial algérien
            </p>
          </div>

          <h1 className="hero-in hero-d1 mt-6 font-heading text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink-900 lg:text-[clamp(2.25rem,3.4vw,3rem)]">
            Les bonnes connexions
            <br />
            font avancer les
            <br />
            <span className="text-brand-orange">bonnes entreprises.</span>
          </h1>

          <p className="hero-in hero-d2 mt-6 max-w-[520px] text-base leading-7 text-ink-600">
            IN NETWORK réunit entrepreneurs, experts, partenaires et opportunités professionnelles
            au sein d&apos;un réseau structuré, accessible et ancré en Algérie.
          </p>

          <div className="hero-in hero-d3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand-orange px-8 text-sm font-semibold text-white shadow-[0_16px_38px_-12px_rgba(212,72,53,0.5)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-orange/90"
            >
              Rejoindre le réseau
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-ink-900/20 px-8 text-sm font-semibold text-ink-900 transition duration-300 hover:border-ink-900 hover:bg-ink-900/[0.03]"
            >
              Découvrir les services
            </Link>
          </div>

          <dl className="hero-in hero-d3 mt-8 grid grid-cols-3 gap-3 border-t border-ink-900/10 pt-5 sm:gap-5">
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

        {/* Pas de wrapper `hero-in` (opacity) ici : un ancêtre avec opacity < 1
            isole le mix-blend-mode et fait réapparaître le fond blanc de la
            vidéo. Le flottement (transform) est porté par la vidéo elle-même. */}
        <div className="relative mx-auto w-full max-w-[660px] lg:mx-0 lg:-ml-[4%] lg:-mr-[18%] lg:w-[122%] lg:max-w-none">
          <MotionSafeVideo
            src="/network-hero.mp4"
            className="hero-float aspect-[6/5] w-full object-cover object-[50%_40%] mix-blend-multiply"
            showControlsOnReducedMotion={false}
            aria-label="Réseau IN NETWORK : entrepreneurs, experts, partenaires, coworking, événements et services reliés à travers l'Algérie"
          />
        </div>
      </div>

      <style>{`
        .hero-in { opacity: 0; transform: translateY(24px); animation: hero-in 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .hero-d1 { animation-delay: 90ms; }
        .hero-d2 { animation-delay: 180ms; }
        .hero-d3 { animation-delay: 300ms; }
        .hero-float { animation: hero-float 8s ease-in-out infinite; }
        @keyframes hero-in { to { opacity: 1; transform: translateY(0); } }
        @keyframes hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @media (prefers-reduced-motion: reduce) {
          .hero-in, .hero-float { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
}
