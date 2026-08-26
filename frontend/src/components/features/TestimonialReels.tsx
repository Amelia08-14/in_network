'use client';

import { useState } from 'react';
import { Quote, Volume2, X } from 'lucide-react';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';
import { cn } from '@/lib/utils';

interface TestimonialItem {
  id: string;
  authorName: string;
  authorRole: string | null;
  content: string | null;
  videoUrl: string | null;
}

// Rangée de témoignages façon "reel" (scroll horizontal, format portrait
// 9:16, lecture en boucle muette en vignette — comme Instagram/TikTok) :
// retour cliente explicite, à la place de l'ancienne grille 2 colonnes qui
// plafonnait la hauteur vidéo et mélangeait texte/vidéo sans hiérarchie.
// Un clic ouvre un lecteur plein cadre avec le son (le vrai contenu).
export function TestimonialReels({ items }: { items: TestimonialItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((t) => t.id === activeId) ?? null;

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((t) =>
          t.videoUrl ? (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className="group relative aspect-9/16 w-[220px] shrink-0 snap-start overflow-hidden rounded-3xl bg-ink-900 text-left ring-1 ring-white/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 sm:w-[240px]"
            >
              <MotionSafeVideo
                src={t.videoUrl}
                playsInline
                showControlsOnReducedMotion={false}
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-900/85 via-ink-900/10 to-transparent" />
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <Volume2 className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                {t.content && <p className="line-clamp-2 text-xs text-white/70">{t.content}</p>}
                <p className="mt-1.5 text-sm font-semibold text-white">{t.authorName}</p>
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
                {t.authorRole && <span className="block font-normal text-white/60">{t.authorRole}</span>}
              </figcaption>
            </figure>
          ),
        )}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
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
              <video src={active.videoUrl ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain" />
            </div>
            <p className="text-center text-sm font-semibold text-white">
              {active.authorName}
              {active.authorRole && <span className="font-normal text-white/60"> — {active.authorRole}</span>}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
