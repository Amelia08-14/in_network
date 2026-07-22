'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const PUBLIC_LINKS = [
  { href: '/annuaire', label: 'Annuaire' },
  { href: '/experts', label: 'Experts' },
  { href: '/services', label: 'Services' },
  { href: '/evenements', label: 'Événements' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/a-propos', label: 'À propos' },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, status, hydrate, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/[0.08] bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo priority />

        <nav className="hidden items-center gap-7 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative py-2 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              {link.label}
              <span className="absolute inset-x-0 -bottom-px h-px scale-x-0 bg-brand-orange transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {status === 'authenticated' && user ? (
            <>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Mon espace
              </Link>
              <Button variant="outline" size="sm" onClick={() => logout()}>
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

        <button
          className="p-2 md:hidden"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {mobileOpen && (
        <div className="border-t border-ink-900/[0.08] md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-card px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-900/[0.04]"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-ink-900/[0.08] pt-3">
              {status === 'authenticated' && user ? (
                <>
                  <Link href="/dashboard" className="px-3 py-2 text-sm font-medium">
                    Mon espace
                  </Link>
                  <button
                    className="px-3 py-2 text-left text-sm font-medium text-brand-orange"
                    onClick={() => logout()}
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-2 text-sm font-medium">
                    Connexion
                  </Link>
                  <Link href="/register" className="px-3 py-2 text-sm font-medium text-brand-orange">
                    Devenir membre
                  </Link>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
