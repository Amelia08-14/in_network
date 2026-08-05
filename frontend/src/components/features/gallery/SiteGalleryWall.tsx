'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, X } from 'lucide-react';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';
import { cn } from '@/lib/utils';
import type { GalleryImageItem } from '@/types';

// Mur de médias du lieu (photos + vidéos réelles envoyées depuis l'admin
// Galerie du lieu) — même pattern masonry + lightbox que EventMediaWall,
// simplifié (pas d'origine/lien événement à afficher ici).
const SPAN_PATTERN = ['row-span-2', 'row-span-1', 'row-span-1', 'row-span-2', 'row-span-1', 'row-span-1'];

export function SiteGalleryWall({ items }: { items: GalleryImageItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      <div className="grid auto-rows-[180px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={cn(
              'group relative overflow-hidden rounded-[1.5rem] bg-ink-900 text-left ring-1 ring-ink-900/[0.06] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-soft-lg',
              SPAN_PATTERN[i % SPAN_PATTERN.length],
            )}
          >
            {item.type === 'VIDEO' ? (
              <MotionSafeVideo
                src={item.url}
                playsInline
                showControlsOnReducedMotion={false}
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : (
              <Image
                src={item.url}
                alt={item.altText ?? 'Espace IN NETWORK à Hydra'}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/60 via-ink-900/0 to-ink-900/0 opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
            {item.type === 'VIDEO' && (
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <Play className="h-3.5 w-3.5 fill-white text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/95 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setOpenIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-[1.5rem] bg-black" onClick={(e) => e.stopPropagation()}>
            {active.type === 'VIDEO' ? (
              <video src={active.url} controls autoPlay playsInline className="h-full w-full object-contain" />
            ) : (
              <Image src={active.url} alt={active.altText ?? ''} fill sizes="90vw" className="object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
