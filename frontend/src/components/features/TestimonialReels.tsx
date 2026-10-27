'use client';

import { useEffect, useState } from 'react';
import { Play, Quote, X } from 'lucide-react';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';
import { cn } from '@/lib/utils';
import type { Testimonial } from '@/lib/testimonials';

/** « Anis · Digital marketeur · Membre depuis 2025 » : prénom, activité, contexte. */
const caption = (t: Testimonial) => [t.authorRole?.trim(), t.authorContext?.trim()].filter(Boolean).join(' · ');

// Sans vignette fournie, le fragment #t=0.1 fait afficher la première image de
// la vidéo avant lecture : toutes les vignettes ont alors le même rendu.
const thumbnailSrc = (url: string) => (url.includes('#') ? url : `${url}#t=0.1`);

// Rangée de témoignages façon "reel" (scroll horizontal, format portrait
// 9:16, lecture en boucle muette en vignette — comme Instagram/TikTok) :
// retour cliente explicite, à la place de l'ancienne grille 2 colonnes qui
// plafonnait la hauteur vidéo et mélangeait texte/vidéo sans hiérarchie.
// Un clic ouvre un lecteur plein cadre avec le son (le vrai contenu).
export function TestimonialReels({ items }: { items: Testimonial[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActiveId(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((t) =>
          t.videoUrl ? (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              aria-label={`Voir le témoignage vidéo de ${t.authorName}`}
              className="group relative aspect-9/16 w-[220px] shrink-0 snap-start overflow-hidden rounded-3xl bg-ink-900 text-left ring-1 ring-white/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 sm:w-[240px]"
            >
              <MotionSafeVideo
                src={thumbnailSrc(t.videoUrl)}
                poster={t.thumbnailUrl ?? undefined}
                aria-hidden
                tabIndex={-1}
                playsInline
                showControlsOnReducedMotion={false}
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-900/85 via-ink-900/10 to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
              </span>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                {t.content && <p className="line-clamp-3 text-xs leading-relaxed text-white/75">« {t.content} »</p>}
                <p className="mt-2 text-sm font-semibold text-white">{t.authorName}</p>
                {caption(t) && <p className="text-xs text-white/60">{caption(t)}</p>}
              </div>
            </button>
          ) : (
            <figure
              key={t.id}
              className="relative flex aspect-9/16 w-[220px] shrink-0 snap-start flex-col justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/4 p-6 backdrop-blur-sm sm:w-[240px]"
            >
              <Quote className="h-6 w-6 shrink-0 text-brand-orange" strokeWidth={2} />
              <blockquote className="mt-3 line-clamp-6 text-sm leading-relaxed text-white/90">{t.content}</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-white">
                {t.authorName}
                {caption(t) && <span className="block font-normal text-white/60">{caption(t)}</span>}
              </figcaption>
            </figure>
          ),
        )}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Témoignage de ${active.authorName}`}
          className={cn(
            'fixed inset-0 z-60 flex items-center justify-center bg-ink-900/95 p-4 backdrop-blur-xs animate-fade-in',
          )}
          onClick={() => setActiveId(null)}
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setActiveId(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative flex max-h-[85vh] w-full max-w-sm flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-9/16 w-full overflow-hidden rounded-3xl bg-black">
              <video src={active.videoUrl ?? undefined} poster={active.thumbnailUrl ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain">
                Votre navigateur ne permet pas de lire cette vidéo.
              </video>
            </div>
            <p className="text-center text-sm font-semibold text-white">
              {active.authorName}
              {caption(active) && <span className="font-normal text-white/60"> — {caption(active)}</span>}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
