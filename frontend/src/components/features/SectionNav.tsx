'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionLink {
  id: string;
  label: string;
  /** Classe de la pastille de couleur (ex. bg-brand-orange). */
  dotClass: string;
}

// Barre de rubriques collante de /services (retours cliente du 06/11/2026) :
// elle défilait horizontalement sans le montrer (barre de défilement masquée),
// on ne voyait pas les rubriques suivantes. Désormais : fondu et flèche du côté
// où il reste des rubriques, défilement au clic, rubrique en cours surlignée et
// ramenée dans la zone visible.
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // Rubrique en cours de lecture (la plus haute visible sous la barre).
  useEffect(() => {
    const targets = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-180px 0px -55% 0px' },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  // La rubrique active reste visible dans la barre.
  useEffect(() => {
    if (!active) return;
    const link = listRef.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    link?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  const scrollBy = (direction: 1 | -1) => {
    const el = listRef.current;
    if (el) el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.6, 200), behavior: 'smooth' });
  };

  const arrow = 'absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink-900 text-white shadow-soft transition-opacity hover:bg-brand-orange';

  return (
    <nav aria-label="Sur cette page" className="sticky top-24 z-30 mb-14 md:top-28">
      <div className="relative w-fit max-w-full rounded-full border border-ink-900/10 bg-white/90 shadow-soft backdrop-blur-xl">
        <ul ref={listRef} onScroll={measure} className="flex gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                data-section={section.id}
                aria-current={active === section.id ? 'location' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  active === section.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/[0.07] hover:text-ink-900',
                )}
              >
                <span aria-hidden className={cn('h-2 w-2 rounded-full', section.dotClass)} />
                {section.label}
              </a>
            </li>
          ))}
        </ul>
        {/* Fondus et flèches : signalent qu'il reste des rubriques de ce côté. */}
        <span aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-16 rounded-l-full bg-linear-to-r from-white to-transparent transition-opacity', canLeft ? 'opacity-100' : 'opacity-0')} />
        <span aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 w-16 rounded-r-full bg-linear-to-l from-white to-transparent transition-opacity', canRight ? 'opacity-100' : 'opacity-0')} />
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Rubriques précédentes" className={cn(arrow, 'left-1.5', canLeft ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => scrollBy(1)} aria-label="Rubriques suivantes" className={cn(arrow, 'right-1.5', canRight ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
