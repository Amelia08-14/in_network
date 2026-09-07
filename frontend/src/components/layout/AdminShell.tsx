'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/store/admin-auth';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

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
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        Administration
      </p>
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, navItems }: { children: React.ReactNode; navItems: AdminNavItem[] }) {
  const pathname = usePathname();
  const logout = useAdminAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-brand-paper">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-900/8 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-ink-900/8 px-6">
          <Logo />
        </div>
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
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-ink-700 hover:bg-ink-900/5"
          >
            <Menu className="h-5 w-5" />
          </button>
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
    </div>
  );
}
