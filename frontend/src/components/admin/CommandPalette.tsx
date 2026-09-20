'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText, Receipt, Search, Target } from 'lucide-react';
import { api } from '@/lib/admin-api';
import { money, STAGE_BY_VALUE } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { SearchResults } from '@/types/crm';

interface Hit {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  group: string;
  icon: typeof Search;
}

// Recherche rapide globale du back-office (Ctrl+K / ⌘K) : leads, devis, factures.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['crm-search', debounced],
    queryFn: () => api.get<{ data: SearchResults }>(`/api/admin/crm/search?q=${encodeURIComponent(debounced)}`).then((r) => r.data),
    enabled: open && debounced.length >= 2,
  });

  const hits = useMemo<Hit[]>(() => {
    if (!data) return [];
    return [
      ...data.leads.map((l) => ({ key: `l-${l.id}`, href: `/admin/crm/leads/${l.id}`, title: `${l.reference} — ${l.title}`, subtitle: `${l.contactName} · ${STAGE_BY_VALUE[l.stage].label}`, group: 'Leads', icon: Target })),
      ...data.quotes.map((q) => ({ key: `q-${q.id}`, href: `/admin/devis/${q.id}`, title: q.number, subtitle: `${q.lead.contactName} · ${money(q.total)}`, group: 'Devis', icon: FileText })),
      ...data.invoices.map((i) => ({ key: `i-${i.id}`, href: `/admin/factures/${i.id}`, title: i.number ?? 'Facture (brouillon)', subtitle: `${i.customerName} · ${money(i.total)}`, group: 'Factures', icon: Receipt })),
    ];
  }, [data]);

  function close() {
    setQuery('');
    setDebounced('');
    setActive(0);
    onClose();
  }

  function go(hit: Hit | undefined) {
    if (!hit) return;
    close();
    router.push(hit.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 p-4 pt-[12vh] backdrop-blur-xs" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche rapide"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-ink-900/8 px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') go(hits[active]);
            }}
            placeholder="Rechercher un lead, un devis, une facture…"
            aria-label="Rechercher"
            className="h-14 flex-1 bg-transparent text-sm text-ink-900 outline-hidden placeholder:text-ink-400"
          />
          <kbd className="rounded-md border border-ink-900/10 px-1.5 py-0.5 text-[11px] text-ink-400">Échap</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {debounced.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">Tapez au moins 2 caractères : nom, entreprise, référence, numéro…</p>
          ) : isError ? (
            <p className="px-3 py-6 text-center text-sm text-brand-orange">Recherche indisponible (droits insuffisants ?).</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">{isFetching ? 'Recherche…' : 'Aucun résultat.'}</p>
          ) : (
            hits.map((hit, index) => (
              <div key={hit.key}>
                {(index === 0 || hits[index - 1].group !== hit.group) && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{hit.group}</p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(hit)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', index === active ? 'bg-ink-900/5' : 'hover:bg-ink-900/3')}
                >
                  <hit.icon className="h-4 w-4 shrink-0 text-ink-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-900">{hit.title}</span>
                    <span className="block truncate text-xs text-ink-500">{hit.subtitle}</span>
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
