'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
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
export function AdminShell({ children, navItems }: { children: React.ReactNode; navItems: AdminNavItem[] }) {
  const pathname = usePathname();
  const logout = useAdminAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen bg-brand-paper">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-900/8 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-ink-900/8 px-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-card px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-ink-900/10 text-ink-700' : 'text-ink-600 hover:bg-ink-900/5',
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-900/8 p-4">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-900/5"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-ink-900/8 bg-white px-4 md:hidden">
          <Logo />
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
