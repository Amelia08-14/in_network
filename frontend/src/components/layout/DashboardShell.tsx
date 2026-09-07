'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function DashboardShell({
  children,
  navItems,
  requireRole,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  requireRole?: ('ADMIN' | 'SUPER_ADMIN')[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, hydrate, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && requireRole && user && !requireRole.includes(user.role as never)) {
      router.replace('/dashboard');
    }
  }, [status, user, requireRole, router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen bg-brand-paper">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-900/8 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-ink-900/8 px-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Espace membre
          </p>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-ink-900/8 p-4">
          <Link
            href="/"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-900/5"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
          <button
            onClick={() => logout().then(() => router.push('/'))}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-900/5"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-900/8 bg-white/90 px-4 backdrop-blur-sm md:hidden">
          <Logo />
          <button
            onClick={() => logout().then(() => router.push('/'))}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-600"
          >
            <LogOut className="h-4 w-4" /> Quitter
          </button>
        </header>

        <main className="p-4 pb-24 md:p-8 md:pb-8">{children}</main>

        {/* Barre de navigation basse — mobile uniquement */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-ink-900/10 bg-white/95 backdrop-blur-md md:hidden">
          {navItems.slice(0, 5).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold',
                  active ? 'text-brand-orange' : 'text-ink-500',
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
