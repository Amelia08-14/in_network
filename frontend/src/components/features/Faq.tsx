'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FaqItem {
  question: string;
  answer: string;
}

// Questions fréquentes (contenu fourni par la cliente, revu avec l'audit du site).
function FaqRow({ item, isOpen, onToggle, number }: { item: FaqItem; isOpen: boolean; onToggle: () => void; number?: number }) {
  return (
    <div className="border-b border-ink-900/[0.08] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="flex items-center gap-4">
          {number !== undefined && (
            <span aria-hidden className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold tabular-nums', isOpen ? 'bg-brand-orange text-white' : 'bg-brand-orange/10 text-brand-orange')}>
              {String(number).padStart(2, '0')}
            </span>
          )}
          <span className="font-heading text-base font-bold text-ink-900">{item.question}</span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-ink-500 transition-transform duration-300', isOpen && 'rotate-180 text-brand-orange')}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          isOpen ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <p className={cn('text-sm leading-relaxed text-ink-600', number !== undefined && 'sm:pl-12')}>{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq({ items, numbered = false }: { items: FaqItem[]; numbered?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y-0 rounded-card border border-ink-900/[0.08] bg-white px-6 shadow-soft">
      {items.map((item, i) => (
        <FaqRow key={item.question} item={item} number={numbered ? i + 1 : undefined} isOpen={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? null : i)} />
      ))}
    </div>
  );
}
