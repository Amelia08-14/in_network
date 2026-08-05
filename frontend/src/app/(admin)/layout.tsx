'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  Users,
  CalendarCheck,
  CreditCard,
  CalendarDays,
  Building2,
  Briefcase,
  ClipboardList,
  BadgeCheck,
  Handshake,
  MessageSquareQuote,
  Images,
  Mail,
  UserCog,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { AdminShell, type AdminNavItem } from '@/components/layout/AdminShell';
import { useAdminAuthStore } from '@/store/admin-auth';
import { ApiRequestError } from '@/lib/admin-api';

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/admin/validations', label: 'Validations', icon: ShieldCheck },
  { href: '/admin/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/admin/membres', label: 'Membres', icon: Users },
  { href: '/admin/reservations', label: 'Réservations', icon: CalendarCheck },
  { href: '/admin/paiements', label: 'Paiements', icon: CreditCard },
  { href: '/admin/evenements', label: 'Événements', icon: CalendarDays },
  { href: '/admin/tarifs', label: 'Tarifs & espaces', icon: Building2 },
  { href: '/admin/services', label: 'Services', icon: Briefcase },
  { href: '/admin/services-demandes', label: 'Demandes de service', icon: ClipboardList },
  { href: '/admin/experts', label: 'Experts', icon: BadgeCheck },
  { href: '/admin/partenaires', label: 'Partenaires', icon: Handshake },
  { href: '/admin/temoignages', label: 'Témoignages', icon: MessageSquareQuote },
  { href: '/admin/galerie', label: 'Galerie du lieu', icon: Images },
  { href: '/admin/contact', label: 'Messages de contact', icon: Mail },
  { href: '/admin/compte', label: 'Mon compte', icon: UserCog },
];

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
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <Logo />
          <h1 className="mt-6 font-heading text-2xl font-bold text-brand-violet-dark">Administration</h1>
          <p className="mt-1 text-sm text-gray-500">Réservé à l&apos;équipe IN NETWORK.</p>

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

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  if (status === 'idle' || status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50" />;
  }

  const isAdmin = status === 'authenticated' && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
  if (!isAdmin) {
    return <AdminLoginScreen />;
  }

  return <AdminShell navItems={NAV_ITEMS}>{children}</AdminShell>;
}
