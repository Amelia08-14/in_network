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

  // Garde-fou côté client en complément de middleware.ts (défense en
  // profondeur si le token d'accès a expiré avant qu'un refresh silencieux
  // n'ait eu lieu).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && requireRole && user && !requireRole.includes(user.role as never)) {
      router.replace('/dashboard');
    }
  }, [status, user, requireRole, router]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-gray-100 px-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-card px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-brand-violet/10 text-brand-violet' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-100 p-4">
          <Link
            href="/"
            className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
          <button
            onClick={() => logout().then(() => router.push('/'))}
            className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-4 md:hidden">
          <Logo />
          <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
            <ArrowLeft className="h-4 w-4" /> Site
          </Link>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white p-2 md:hidden">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
                  active ? 'bg-ink-900 text-white' : 'text-ink-600',
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

