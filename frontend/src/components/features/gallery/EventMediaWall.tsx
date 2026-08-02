'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, X, ArrowUpRight } from 'lucide-react';
import { EVENT_ORIGIN_LABEL, EVENT_ORIGIN_VARIANT, Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EventMediaItem } from '@/types';

// Mur de médias événements — masonry léger (tailles variées) + lightbox
// supportant à la fois images et vidéos. Rythme volontairement irrégulier
// (spans variables) pour ne pas retomber sur une grille uniforme.
const SPAN_PATTERN = ['row-span-2', 'row-span-1', 'row-span-1', 'row-span-2', 'row-span-1', 'row-span-1'];

export function EventMediaWall({ items }: { items: EventMediaItem[] }) {
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
            {item.type === 'video' ? (
              <video
                src={item.url}
                muted
                loop
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : (
              <Image
                src={item.url}
                alt={item.altText ?? item.eventTitle}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/0 to-ink-900/0 opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
            {item.type === 'video' && (
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <Play className="h-3.5 w-3.5 fill-white text-white" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
              <Badge variant={EVENT_ORIGIN_VARIANT[item.eventOrigin] ?? 'neutral'} className="w-fit">
                {EVENT_ORIGIN_LABEL[item.eventOrigin] ?? item.eventOrigin}
              </Badge>
              <p className="font-heading text-sm font-bold text-white">{item.eventTitle}</p>
            </div>
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
          <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] bg-black">
              {active.type === 'video' ? (
                <video src={active.url} controls autoPlay playsInline className="h-full w-full object-contain" />
              ) : (
                <Image src={active.url} alt={active.altText ?? active.eventTitle} fill sizes="90vw" className="object-contain" />
              )}
            </div>
            <div className="flex items-center justify-between rounded-[1.25rem] bg-white/[0.06] px-5 py-3 backdrop-blur">
              <div>
                <Badge variant={EVENT_ORIGIN_VARIANT[active.eventOrigin] ?? 'neutral'}>
                  {EVENT_ORIGIN_LABEL[active.eventOrigin] ?? active.eventOrigin}
                </Badge>
                <p className="mt-1 font-heading font-bold text-white">{active.eventTitle}</p>
              </div>
              <Link
                href={`/evenements/${active.eventSlug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white"
              >
                Voir l&apos;événement <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
