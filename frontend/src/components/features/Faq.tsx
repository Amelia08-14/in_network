'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FaqItem {
  question: string;
  answer: string;
}

// Brief client §4.11 — contenu FAQ fourni tel quel, pas de génération.
function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-ink-900/[0.08] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="font-heading text-base font-bold text-ink-900">{item.question}</span>
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
          <p className="text-sm leading-relaxed text-ink-600">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y-0 rounded-card border border-ink-900/[0.08] bg-white px-6 shadow-soft">
      {items.map((item, i) => (
        <FaqRow key={item.question} item={item} isOpen={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? null : i)} />
      ))}
    </div>
  );
}
