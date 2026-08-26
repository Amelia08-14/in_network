'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, X, ArrowUpRight } from 'lucide-react';
import { EVENT_ORIGIN_LABEL, EVENT_ORIGIN_VARIANT, Badge } from '@/components/ui/badge';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { EventMediaItem } from '@/types';

// Mur de médias événements — masonry léger (tailles variées) + lightbox
// supportant à la fois images et vidéos. Rythme volontairement irrégulier
// (spans variables) pour ne pas retomber sur une grille uniforme.
const SPAN_PATTERN = ['row-span-2', 'row-span-1', 'row-span-1', 'row-span-2', 'row-span-1', 'row-span-1'];

const ORIGIN_TABS: { label: string; value: EventMediaItem['eventOrigin'] | 'ALL' }[] = [
  { label: 'Tous', value: 'ALL' },
  { label: EVENT_ORIGIN_LABEL.IN_EVENT, value: 'IN_EVENT' },
  { label: EVENT_ORIGIN_LABEL.EXTERNAL, value: 'EXTERNAL' },
  { label: EVENT_ORIGIN_LABEL.CO_ORGANIZED, value: 'CO_ORGANIZED' },
];

const TYPE_TABS: { label: string; value: 'ALL' | 'image' | 'video' }[] = [
  { label: 'Tout', value: 'ALL' },
  { label: 'Photos', value: 'image' },
  { label: 'Vidéos', value: 'video' },
];

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-ink-900 text-white' : 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/9',
      )}
    >
      {children}
    </button>
  );
}

export function EventMediaWall({ items }: { items: EventMediaItem[] }) {
  const [origin, setOrigin] = useState<(typeof ORIGIN_TABS)[number]['value']>('ALL');
  const [type, setType] = useState<(typeof TYPE_TABS)[number]['value']>('ALL');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = items.filter(
    (item) => (origin === 'ALL' || item.eventOrigin === origin) && (type === 'ALL' || item.type === type),
  );
  const active = openIndex !== null ? filtered[openIndex] : null;

  function setOriginFilter(value: (typeof ORIGIN_TABS)[number]['value']) {
    setOrigin(value);
    setOpenIndex(null);
  }
  function setTypeFilter(value: (typeof TYPE_TABS)[number]['value']) {
    setType(value);
    setOpenIndex(null);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {ORIGIN_TABS.map((tab) => (
            <FilterPill key={tab.label} active={tab.value === origin} onClick={() => setOriginFilter(tab.value)}>
              {tab.label}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <FilterPill key={tab.label} active={tab.value === type} onClick={() => setTypeFilter(tab.value)}>
              {tab.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun média pour ce filtre" description="Essaie une autre combinaison de filtres." />
      ) : (
      <div className="grid auto-rows-[180px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={cn(
              'group relative overflow-hidden rounded-3xl bg-ink-900 text-left ring-1 ring-ink-900/6 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-soft-lg',
              SPAN_PATTERN[i % SPAN_PATTERN.length],
            )}
          >
            {item.type === 'video' ? (
              <MotionSafeVideo
                src={item.url}
                playsInline
                showControlsOnReducedMotion={false}
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
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-900/80 via-ink-900/0 to-ink-900/0 opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
            {item.type === 'video' && (
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
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
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-ink-900/95 p-4 backdrop-blur-xs animate-fade-in"
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
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-black">
              {active.type === 'video' ? (
                <video src={active.url} controls autoPlay playsInline className="h-full w-full object-contain" />
              ) : (
                <Image src={active.url} alt={active.altText ?? active.eventTitle} fill sizes="90vw" className="object-contain" />
              )}
            </div>
            <div className="flex items-center justify-between rounded-[1.25rem] bg-white/6 px-5 py-3 backdrop-blur-sm">
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
