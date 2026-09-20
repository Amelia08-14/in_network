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
  Landmark,
  Briefcase,
  ClipboardList,
  BadgeCheck,
  Handshake,
  MessageSquareQuote,
  Images,
  Mail,
  UserCog,
  Gauge,
  KanbanSquare,
  CalendarClock,
  NotebookPen,
  FileText,
  Receipt,
  Rocket,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { AdminShell, type AdminNavItem } from '@/components/layout/AdminShell';
import { useAdminAuthStore } from '@/store/admin-auth';
import { ApiRequestError } from '@/lib/admin-api';

// `resource` = clé de permission (cf. types DASHBOARD_RESOURCES) utilisée
// pour masquer l'entrée aux OFFICE_MANAGER sans le droit correspondant.
// `superOnly` = visible seulement pour ADMIN / SUPER_ADMIN.
type NavEntry = AdminNavItem & {
  resource?: string;
  /** Visible dès que l'un de ces droits est accordé. */
  resources?: string[];
  /** Chemin d'entrée quand seul un droit secondaire est accordé. */
  fallbackHref?: string;
  superOnly?: boolean;
};

const NAV_ITEMS: NavEntry[] = [
  // Pilotage
  { href: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, resource: 'stats', section: 'Pilotage' },
  { href: '/admin/validations', label: 'Validations', icon: ShieldCheck, resource: 'validations', section: 'Pilotage' },
  { href: '/admin/statistiques', label: 'Statistiques', icon: BarChart3, resource: 'stats', section: 'Pilotage' },
  // Commercial : du lead à la facture et au lancement du service
  { href: '/admin/crm', label: 'Tableau commercial', icon: Gauge, resource: 'crm', section: 'Commercial' },
  { href: '/admin/crm/pipeline', label: 'Pipeline', icon: KanbanSquare, resource: 'crm', section: 'Commercial' },
  { href: '/admin/crm/agenda', label: 'Agenda', icon: CalendarClock, resource: 'crm', section: 'Commercial' },
  { href: '/admin/crm/activite', label: 'Activité', icon: NotebookPen, resource: 'crm', section: 'Commercial' },
  { href: '/admin/devis', label: 'Devis', icon: FileText, resource: 'quotes', section: 'Commercial' },
  { href: '/admin/factures', label: 'Factures', icon: Receipt, resource: 'invoices', section: 'Commercial' },
  { href: '/admin/lancements', label: 'Lancement des services', icon: Rocket, resource: 'fulfilment', section: 'Commercial' },
  { href: '/admin/services-demandes', label: 'Demandes de service', icon: ClipboardList, resource: 'service_requests', section: 'Commercial' },
  { href: '/admin/paiements', label: 'Paiements', icon: CreditCard, resource: 'payments', section: 'Commercial' },
  // Communauté
  { href: '/admin/membres', label: 'Membres', icon: Users, resource: 'members', section: 'Communauté' },
  { href: '/admin/entreprises', label: 'Entreprises', icon: Landmark, resource: 'companies', section: 'Communauté' },
  { href: '/admin/reservations', label: 'Réservations', icon: CalendarCheck, resource: 'bookings', section: 'Communauté' },
  { href: '/admin/evenements', label: 'Événements', icon: CalendarDays, resource: 'events', section: 'Communauté' },
  { href: '/admin/experts', label: 'Experts', icon: BadgeCheck, resource: 'experts', section: 'Communauté' },
  { href: '/admin/partenaires', label: 'Partenaires', icon: Handshake, resource: 'partners', section: 'Communauté' },
  { href: '/admin/temoignages', label: 'Témoignages', icon: MessageSquareQuote, resource: 'testimonials', section: 'Communauté' },
  // Catalogue & site
  // Services et tarifs : un seul onglet (deux vues, cf. ServicesTarifsHeader).
  { href: '/admin/services', alsoMatch: ['/admin/tarifs'], label: 'Services & tarifs', icon: Briefcase, resources: ['services', 'plans', 'spaces'], fallbackHref: '/admin/tarifs', section: 'Catalogue & site' },
  { href: '/admin/galerie', label: 'Galerie du lieu', icon: Images, resource: 'galerie', section: 'Catalogue & site' },
  { href: '/admin/contact', label: 'Messages de contact', icon: Mail, resource: 'contact', section: 'Catalogue & site' },
  // Système
  { href: '/admin/compte', label: 'Utilisateurs système', icon: UserCog, superOnly: true, section: 'Système' },
];

function visibleNavItems(role: string, permissions: Record<string, string> | null | undefined): AdminNavItem[] {
  const isFullAccess = role === 'ADMIN' || role === 'SUPER_ADMIN';
  return NAV_ITEMS.filter((item) => {
    if (item.superOnly) return isFullAccess;
    if (isFullAccess) return true;
    const keys = item.resources ?? (item.resource ? [item.resource] : []);
    return keys.some((key) => Boolean(permissions?.[key]));
  }).map(({ resource, resources, fallbackHref, superOnly, ...navItem }) => ({
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
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'OFFICE_MANAGER') {
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
    <div className="flex min-h-screen items-center justify-center bg-brand-paper px-4">
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

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  if (status === 'idle' || status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-brand-paper" />;
  }

  const isAdmin =
    status === 'authenticated' &&
    user &&
    (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'OFFICE_MANAGER');
  if (!isAdmin) {
    return <AdminLoginScreen />;
  }

  return (
    <AdminShell navItems={visibleNavItems(user.role, user.permissions ?? null)}>{children}</AdminShell>
  );
}
