'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NAV_ITEMS, isHiddenPath } from '@/lib/admin-nav';
import { usePlatformOptions } from '@/lib/options';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { AdminShell, type AdminNavItem } from '@/components/layout/AdminShell';
import { useAdminAuthStore } from '@/store/admin-auth';
import { ApiRequestError } from '@/lib/admin-api';
import { isStaffRole } from '@/types';

function visibleNavItems(
  role: string,
  permissions: Record<string, string> | null | undefined,
  crmAccess: { allLeads: boolean; manageLeads: boolean } | null | undefined,
  hidden: string[],
): AdminNavItem[] {
  const isFullAccess = role === 'ADMIN' || role === 'SUPER_ADMIN';
  return NAV_ITEMS.filter((item) => {
    if (item.alwaysVisible) return true;
    // Rubrique masquée par le super administrateur (lui la garde, pour la réactiver).
    if (role !== 'SUPER_ADMIN' && hidden.includes(item.href)) return false;
    if (item.superOnly) return isFullAccess;
    if (item.manageLeadsOnly && !crmAccess?.manageLeads) return false;
    if (isFullAccess) return true;
    const keys = item.resources ?? (item.resource ? [item.resource] : []);
    return keys.some((key) => Boolean(permissions?.[key]));
  }).map(({ resource, resources, fallbackHref, superOnly, manageLeadsOnly, alwaysVisible, ...navItem }) => ({
    ...navItem,
    // Compte restreint sans droit sur le premier volet : on entre par l'autre.
    href: !isFullAccess && fallbackHref && resources && !permissions?.[resources[0]] ? fallbackHref : navItem.href,
  }));
}

// Porte de connexion admin — même principe que in_academy (frontend/app/(admin)/layout.tsx
// sur ce PC) : pas de redirection vers une page /login séparée, l'écran de
// connexion s'affiche directement à /admin tant qu'aucune session admin
// valide n'existe. Session totalement indépendante de useAuthStore (membres).
function AdminLoginScreen() {
  const login = useAdminAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login(email, password);
      if (!isStaffRole(user.role)) {
        await useAdminAuthStore.getState().logout();
        setError('Ce compte ne dispose pas des droits administrateur.');
      }
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Connexion impossible');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <Logo />
          <h1 className="mt-6 font-heading text-2xl font-bold text-ink-900">Administration</h1>
          <p className="mt-1 text-sm text-ink-500">Réservé à l&apos;équipe IN NETWORK.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-brand-orange">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status, hydrate } = useAdminAuthStore();
  const pathname = usePathname();
  const { data: options } = usePlatformOptions();
  const hidden = options?.hiddenModules ?? [];

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  if (status === 'idle' || status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center" />;
  }

  const isAdmin =
    status === 'authenticated' &&
    user &&
    isStaffRole(user.role);
  if (!isAdmin) {
    return <AdminLoginScreen />;
  }

  const blocked = user.role !== 'SUPER_ADMIN' && isHiddenPath(pathname, hidden);
  return (
    <AdminShell navItems={visibleNavItems(user.role, user.permissions ?? null, user.crmAccess, hidden)}>
      {blocked ? <EmptyState title="Rubrique désactivée" description="Cette rubrique a été retirée du dashboard par le super administrateur." /> : children}
    </AdminShell>
  );
}
