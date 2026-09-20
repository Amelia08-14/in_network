'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { CartLink } from './CartLink';
import { NavDropdown, type NavGroupItem } from './NavDropdown';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
}
interface NavGroup {
  label: string;
  items: NavGroupItem[];
}

// Ordre du parcours d'un visiteur : ce que l'on propose (services & tarifs ne
// font qu'une page), la communauté (annuaire, experts, partenaires regroupés
// sous « Le réseau »), la vie du lieu, puis qui nous sommes et comment nous
// joindre.
const NAV: (NavLink | NavGroup)[] = [
  { href: '/services', label: 'Services & tarifs' },
  {
    label: 'Le réseau',
    items: [
      { href: '/annuaire', label: 'Annuaire des membres', description: 'Entrepreneurs et entreprises du réseau' },
      { href: '/experts', label: 'Experts', description: 'Des experts pour vous accompagner' },
      { href: '/partenaires', label: 'Partenaires', description: 'Institutions et réseaux partenaires' },
    ],
  },
  { href: '/evenements', label: 'Événements' },
  { href: '/a-propos', label: 'À propos' },
  { href: '/contact', label: 'Contact' },
];

const isGroup = (entry: NavLink | NavGroup): entry is NavGroup => 'items' in entry;
const isActive = (pathname: string | null, href: string) =>
  pathname === href || Boolean(pathname?.startsWith(href + '/'));

// Nav flottante détachée du haut (glass pill) — plus une barre pleine
// largeur collée en haut de page. Le contenu compense via pt-28/pt-32 sur
// <main> (voir (public)/layout.tsx).
export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, status, hydrate, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 md:top-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-full border border-ink-900/10 bg-white/75 px-4 py-2.5 shadow-soft-lg backdrop-blur-xl transition-shadow duration-300 md:px-5">
        <Logo priority className="h-11" />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <NavDropdown
                key={entry.label}
                label={entry.label}
                items={entry.items}
                active={entry.items.some((item) => isActive(pathname, item.href))}
              />
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  'relative whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 xl:px-3.5',
                  isActive(pathname, entry.href)
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900',
                )}
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <CartLink />
          {status === 'authenticated' && user ? (
            <>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Mon espace
              </Link>
              <Button variant="secondary" size="sm" onClick={() => logout()}>
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Connexion
              </Link>
              <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
                Devenir membre
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <CartLink />
          <button
            className="rounded-full p-2 hover:bg-ink-900/5"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 w-full max-w-6xl overflow-hidden rounded-3xl border border-ink-900/10 bg-white/95 p-3 shadow-soft-lg backdrop-blur-xl motion-safe:animate-fade-in-up lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <div key={entry.label} className="my-1 border-y border-ink-900/8 py-2">
                  <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                    {entry.label}
                  </p>
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-900/5"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-900/5"
                >
                  {entry.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-2 flex flex-col gap-1 border-t border-ink-900/8 pt-3">
            {status === 'authenticated' && user ? (
              <>
                <Link href="/dashboard" className="rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-900/5">
                  Mon espace
                </Link>
                <button
                  className="rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-brand-orange hover:bg-ink-900/5"
                  onClick={() => logout()}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-900/5">
                  Connexion
                </Link>
                <Link href="/register" className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-brand-orange hover:bg-ink-900/5">
                  Devenir membre
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
