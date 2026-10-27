'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface TagOption {
  id: string;
  label: string;
  group: string | null;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Référentiel complet des compétences ou des domaines d'activité (groupé par
 * famille, cf. backend/prisma/taxonomy.ts), mis en cache : il ne change pas d'une
 * page à l'autre.
 */
export function useTagOptions(category: 'SKILL' | 'SECTOR') {
  return useQuery({
    queryKey: ['tags', category, 'all'],
    queryFn: () => api.get<{ data: TagOption[] }>(`/api/tags?category=${category}&all=1`).then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });
}

/** Groupe les options par famille (celles sans famille — saisies libres — en dernier). */
export function groupTagOptions(options: TagOption[]): [string, TagOption[]][] {
  const groups = new Map<string, TagOption[]>();
  for (const option of options) {
    const key = option.group ?? 'Autres (saisis par les membres)';
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const aOther = a.startsWith('Autres');
    const bOther = b.startsWith('Autres');
    if (aOther !== bOther) return aOther ? 1 : -1;
    return a.localeCompare(b, 'fr');
  });
}

// Sélecteur à choix multiples : tape pour filtrer la longue liste (compétences ou
// domaines d'activité, groupés par famille), ou ajoute ta propre étiquette si
// la tienne n'y figure pas. Clavier : ↑ ↓ pour naviguer, Entrée pour ajouter,
// Échap pour fermer, Retour arrière pour retirer la dernière.
export function TagPicker({
  label,
  category,
  value,
  onChange,
  max,
  placeholder,
  hint,
  tone = 'ink',
  closed = false,
}: {
  label: string;
  category: 'SKILL' | 'SECTOR';
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  placeholder?: string;
  hint?: string;
  tone?: 'ink' | 'orange' | 'blue';
  /** Liste fermée : seulement les libellés du référentiel, pas de saisie libre (domaines d'activité). */
  closed?: boolean;
}) {
  const id = useId();
  const { data: allOptions = [], isLoading } = useTagOptions(category);
  // Liste fermée : les étiquettes saisies librement par d'autres membres (sans famille) ne sont pas proposées.
  const options = useMemo(() => (closed ? allOptions.filter((o) => o.group) : allOptions), [allOptions, closed]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => new Set(value.map(normalize)), [value]);
  const full = value.length >= max;

  // Options visibles : non sélectionnées, filtrées par la saisie, à plat pour la navigation clavier.
  const grouped = useMemo(() => {
    const q = normalize(query);
    const visible = options.filter((o) => !selected.has(normalize(o.label)) && (!q || normalize(o.label).includes(q) || normalize(o.group ?? '').includes(q)));
    return groupTagOptions(visible);
  }, [options, query, selected]);
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  const trimmed = query.trim();
  const canCreate = !closed && trimmed.length > 1 && trimmed.length <= 80 && !selected.has(normalize(trimmed)) && !options.some((o) => normalize(o.label) === normalize(trimmed));
  const rows = canCreate ? [...flat.map((o) => ({ kind: 'option' as const, label: o.label })), { kind: 'create' as const, label: trimmed }] : flat.map((o) => ({ kind: 'option' as const, label: o.label }));

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function add(next: string) {
    const clean = next.trim();
    if (!clean || full || selected.has(normalize(clean))) return;
    onChange([...value, clean]);
    setQuery('');
    setActive(0);
  }

  const chipClass = {
    ink: 'bg-ink-900/8 text-ink-800',
    orange: 'bg-brand-orange/10 text-brand-orange',
    blue: 'bg-brand-blue/10 text-brand-blue',
  }[tone];

  // Position de chaque option dans la liste à plat (navigation clavier), calculée hors rendu.
  const indexed = useMemo(
    () =>
      grouped.map(([group, items], groupIndex) => {
        const start = grouped.slice(0, groupIndex).reduce((count, [, list]) => count + list.length, 0);
        return [group, items.map((item, i) => ({ item, index: start + i }))] as const;
      }),
    [grouped],
  );

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={`${id}-input`} className="block text-sm font-medium text-ink-800">
        {label}
        <span className="ml-2 text-xs font-normal text-ink-500">
          {value.length} / {max}
        </span>
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}

      <div
        className={cn('mt-1.5 flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-ink-900/15 bg-white px-2.5 py-2 transition-shadow', open && 'border-ink-900/40 ring-2 ring-ink-900/10')}
        onClick={() => document.getElementById(`${id}-input`)?.focus()}
      >
        {value.map((item) => (
          <span key={item} className={cn('inline-flex items-center gap-1 rounded-pill py-1 pl-3 pr-1.5 text-xs font-semibold', chipClass)}>
            {item}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== item)); }} aria-label={`Retirer ${item}`} className="rounded-full p-0.5 hover:bg-black/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex min-w-40 flex-1 items-center gap-1.5">
          <Search className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          <input
            id={`${id}-input`}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            disabled={full && !open}
            placeholder={full ? `Maximum atteint (${max})` : value.length ? 'Ajouter…' : placeholder ?? 'Rechercher dans la liste…'}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const row = rows[active];
                if (row) add(row.label);
                else if (canCreate) add(trimmed);
              } else if (e.key === 'Escape') {
                setOpen(false);
              } else if (e.key === 'Backspace' && !query && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-hidden placeholder:text-ink-400"
          />
          <button type="button" tabIndex={-1} aria-label={open ? 'Fermer la liste' : 'Ouvrir la liste'} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="rounded-md p-1 text-ink-500 hover:bg-ink-900/5">
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-ink-900/12 bg-white shadow-soft-lg">
          <ul id={`${id}-list`} ref={listRef} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1" data-lenis-prevent>
            {isLoading && <li className="px-4 py-3 text-sm text-ink-500">Chargement de la liste…</li>}
            {!isLoading && rows.length === 0 && <li className="px-4 py-3 text-sm text-ink-500">{full ? `Vous avez atteint le maximum (${max}).` : 'Aucun résultat dans la liste.'}</li>}
            {indexed.map(([group, items]) => (
              <li key={group} role="presentation">
                <p className="sticky top-0 bg-ink-900/[0.04] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">{group}</p>
                <ul role="presentation">
                  {items.map(({ item, index }) => {
                    const isActive = index === active;
                    return (
                      <li key={item.id} role="option" aria-selected={false} data-active={isActive} onMouseEnter={() => setActive(index)} onMouseDown={(e) => { e.preventDefault(); add(item.label); }} className={cn('flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm text-ink-800', isActive && 'bg-ink-900/[0.06]')}>
                        {item.label}
                        <Plus className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {canCreate && !full && (
              <li
                role="option"
                aria-selected={false}
                data-active={active === rows.length - 1}
                onMouseEnter={() => setActive(rows.length - 1)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(trimmed);
                }}
                className={cn('flex cursor-pointer items-center gap-2 border-t border-ink-900/8 px-4 py-2.5 text-sm font-semibold text-brand-blue', active === rows.length - 1 && 'bg-ink-900/[0.06]')}
              >
                <Plus className="h-4 w-4" /> Ajouter « {trimmed} »
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
