'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavGroupItem {
  href: string;
  label: string;
  description: string;
}

// Sous-menu de la nav desktop (pattern « disclosure ») : s'ouvre au survol ET
// au clic/clavier, se ferme avec Échap, en quittant la zone ou après un clic
// sur un lien. Le bouton porte aria-expanded ; pas de rôle `menu` (réservé aux
// menus d'application), juste une liste de liens.
export function NavDropdown({
  label,
  items,
  active,
}: {
  label: string;
  items: NavGroupItem[];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 xl:px-3.5',
          active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900',
          open && !active && 'bg-ink-900/5 text-ink-900',
        )}
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* pt-3 : pont invisible entre le bouton et le panneau pour que le
          survol ne se coupe pas en traversant l'espace. */}
      <div
        id={panelId}
        className={cn(
          'absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 transition duration-150',
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
        )}
      >
        <ul className="rounded-2xl border border-ink-900/10 bg-white p-2 shadow-soft-lg">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3.5 py-2.5 transition-colors hover:bg-ink-900/5 focus-visible:bg-ink-900/5"
              >
                <span className="block text-sm font-semibold text-ink-900">{item.label}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
