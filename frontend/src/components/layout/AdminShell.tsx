'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, Search, X } from 'lucide-react';
import { Logo } from './Logo';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { cn } from '@/lib/utils';
import { HUE, type Hue } from '@/lib/palette';
import { useAdminAuthStore } from '@/store/admin-auth';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Titre du groupe sous lequel l'entrée s'affiche (Pilotage, Commercial…). */
  section?: string;
  /** Autres chemins qui gardent cette entrée active (vues d'un même onglet). */
  alsoMatch?: string[];
}

// Une teinte par section du menu (cf. lib/palette.ts).
const SECTION_HUE: Record<string, Hue> = {
  Pilotage: 'blue',
  Commercial: 'orange',
  Communauté: 'green',
  'Catalogue & site': 'amber',
  Système: 'gray',
};

// Coquille du back-office /admin — distincte de DashboardShell (espace
// membre) : nav et déconnexion branchées sur useAdminAuthStore, jamais sur
// la session membre. Rendue uniquement une fois l'accès admin confirmé par
// (admin)/layout.tsx — pas de logique d'auth ici.
function AdminNavList({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: AdminNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  // Une seule entrée active : la plus spécifique (« /admin/crm/pipeline »
  // l'emporte sur « /admin/crm » et sur « /admin »).
  const matchLength = (item: AdminNavItem) =>
    Math.max(
      0,
      ...[item.href, ...(item.alsoMatch ?? [])]
        .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
        .map((path) => path.length),
    );
  const activeHref = [...navItems].sort((a, b) => matchLength(b) - matchLength(a)).find((item) => matchLength(item) > 0)?.href;

  return (
    <nav className="flex-1 overflow-y-auto p-4">
      {navItems.map((item, index) => {
        const active = item.href === activeHref;
        const showSection = item.section && item.section !== navItems[index - 1]?.section;
        return (
          <div key={item.href}>
            {showSection && (
              <p className={cn('flex items-center gap-2 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400', index > 0 ? 'pt-5' : 'pt-0')}>
                <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', HUE[SECTION_HUE[item.section!] ?? 'gray'].solid)} />
                {item.section}
              </p>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900',
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', !active && HUE[SECTION_HUE[item.section ?? ''] ?? 'gray'].text)} strokeWidth={2} /> {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm text-ink-500 hover:border-ink-900/20 hover:bg-ink-900/3"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Rechercher…</span>
      <kbd className="rounded-md border border-ink-900/10 px-1.5 py-0.5 text-[11px] text-ink-400">Ctrl K</kbd>
    </button>
  );
}

export function AdminShell({ children, navItems }: { children: React.ReactNode; navItems: AdminNavItem[] }) {
  const pathname = usePathname();
  const logout = useAdminAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // La recherche globale porte sur les leads / devis / factures : réservée aux
  // comptes qui voient le bloc CRM.
  const canSearch = navItems.some((item) => item.href === '/admin/crm');

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!canSearch) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canSearch]);

  return (
    <div className="flex min-h-screen bg-brand-paper">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-900/8 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-ink-900/8 px-6">
          <Logo />
        </div>
        {canSearch && <SearchButton onClick={() => setSearchOpen(true)} />}
        <AdminNavList navItems={navItems} pathname={pathname} />
        <div className="border-t border-ink-900/8 p-4">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-900/5"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-900/8 bg-white/90 px-4 backdrop-blur-sm md:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            {canSearch && (
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Rechercher"
                className="rounded-lg p-2 text-ink-700 hover:bg-ink-900/5"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-lg p-2 text-ink-700 hover:bg-ink-900/5"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8">{children}</main>
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-soft-lg">
            <div className="flex h-14 items-center justify-between border-b border-ink-900/8 px-4">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-lg p-2 text-ink-700 hover:bg-ink-900/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AdminNavList navItems={navItems} pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="border-t border-ink-900/8 p-4">
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-900/5"
              >
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {canSearch && <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
