'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 5000;

// Carrousel horizontal (scroll-snap natif) : glisse au doigt/trackpad, flèches
// précédent/suivant, défilement automatique qui se met en pause au survol, au
// focus et au toucher, et qui n'existe pas du tout avec prefers-reduced-motion.
// Les cartes (server components) arrivent en children : rien n'est ré-implémenté
// ici, ce composant ne gère que le défilement.
export function ServicesCarousel({ children, label }: { children: ReactNode; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 20 : track.clientWidth * 0.8;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    if (direction === 1 && atEnd) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: direction * step, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => scrollByCard(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, scrollByCard]);

  const arrowClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-900/15 bg-white text-ink-900 shadow-soft transition hover:border-brand-orange hover:bg-brand-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-ink-900/15 disabled:hover:bg-white disabled:hover:text-ink-900';

  return (
    <div
      role="region"
      aria-roledescription="carrousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <ul
        ref={trackRef}
        onScroll={updateEdges}
        className="-mx-4 flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <li className={cn('w-[82%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]')}>
            {child}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={() => scrollByCard(-1)} disabled={edges.start} aria-label="Services précédents" className={arrowClass}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => scrollByCard(1)} aria-label="Services suivants" className={arrowClass}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
