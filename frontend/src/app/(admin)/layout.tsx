'use client';

import { useEffect, useState } from 'react';
import {
  Sun,
  BarChart3,
  Users,
  CalendarCheck,
  CalendarDays,
  Landmark,
  Briefcase,
  BadgeCheck,
  Handshake,
  MessageSquareQuote,
  Images,
  UserCog,
  Gauge,
  KanbanSquare,
  CalendarClock,
  NotebookPen,
  FileText,
  Receipt,
  PackageCheck,
  Inbox,
  CircleUserRound,
  Coins,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { AdminShell, type AdminNavItem } from '@/components/layout/AdminShell';
import { useAdminAuthStore } from '@/store/admin-auth';
import { ApiRequestError } from '@/lib/admin-api';
import { isStaffRole } from '@/types';

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
  /** Visible seulement pour les comptes qui qualifient / assignent les leads. */
  manageLeadsOnly?: boolean;
  /** Visible pour tous les comptes du back-office (ex. « Mon compte »). */
  alwaysVisible?: boolean;
};

// Menu dans l'ordre du processus commercial v1.3 : on entre par sa journée,
// puis les prospects (aiguillage → pipeline), les ventes (devis → proforma →
// paiement), les clients (membres, services livrés, échéances), les
// commissions, et enfin le pilotage, le contenu du site et le système.
const NAV_ITEMS: NavEntry[] = [
  { href: '/admin', label: 'Ma journée', icon: Sun, alwaysVisible: true, section: 'Accueil' },
  // Prospects : du lead entrant à la visite confirmée
  { href: '/admin/crm/entrants', alsoMatch: ['/admin/services-demandes', '/admin/contact'], label: 'À aiguiller', icon: Inbox, resource: 'crm', manageLeadsOnly: true, section: 'Prospects' },
  { href: '/admin/crm/pipeline', alsoMatch: ['/admin/crm/leads'], label: 'Pipeline', icon: KanbanSquare, resource: 'crm', section: 'Prospects' },
  { href: '/admin/crm/agenda', label: 'Agenda', icon: CalendarClock, resource: 'crm', section: 'Prospects' },
  { href: '/admin/crm/activite', label: 'Journal d’activité', icon: NotebookPen, resource: 'crm', section: 'Prospects' },
  // Ventes : devis, proforma, paiement
  { href: '/admin/devis', label: 'Devis', icon: FileText, resource: 'quotes', section: 'Ventes' },
  { href: '/admin/factures', alsoMatch: ['/admin/paiements'], label: 'Proformas et factures', icon: Receipt, resource: 'invoices', section: 'Ventes' },
  // Clients : activation, livraison, échéances, fiche membre
  { href: '/admin/lancements', label: 'Services clients', icon: PackageCheck, resource: 'fulfilment', section: 'Clients' },
  { href: '/admin/membres', label: 'Membres', icon: Users, resource: 'members', section: 'Clients' },
  { href: '/admin/entreprises', label: 'Entreprises', icon: Landmark, resource: 'companies', section: 'Clients' },
  { href: '/admin/reservations', label: 'Réservations', icon: CalendarCheck, resource: 'bookings', section: 'Clients' },
  // Commissions
  { href: '/admin/commissions', label: 'Commissions', icon: Coins, resource: 'commissions', section: 'Commissions' },
  // Pilotage
  { href: '/admin/crm', label: 'Tableau commercial', icon: Gauge, resource: 'crm', section: 'Pilotage' },
  { href: '/admin/statistiques', label: 'Statistiques du lieu', icon: BarChart3, resource: 'stats', section: 'Pilotage' },
  // Communauté et site
  { href: '/admin/evenements', label: 'Événements', icon: CalendarDays, resource: 'events', section: 'Communauté et site' },
  { href: '/admin/experts', label: 'Experts', icon: BadgeCheck, resource: 'experts', section: 'Communauté et site' },
  { href: '/admin/partenaires', label: 'Partenaires', icon: Handshake, resource: 'partners', section: 'Communauté et site' },
  { href: '/admin/temoignages', label: 'Témoignages', icon: MessageSquareQuote, resource: 'testimonials', section: 'Communauté et site' },
  // Services et tarifs : un seul onglet (deux vues, cf. ServicesTarifsHeader).
  { href: '/admin/services', alsoMatch: ['/admin/tarifs'], label: 'Services et tarifs', icon: Briefcase, resources: ['services', 'plans', 'spaces'], fallbackHref: '/admin/tarifs', section: 'Communauté et site' },
  { href: '/admin/galerie', label: 'Galerie du lieu', icon: Images, resource: 'galerie', section: 'Communauté et site' },
  // Système
  { href: '/admin/mon-compte', label: 'Mon compte', icon: CircleUserRound, alwaysVisible: true, section: 'Système' },
  { href: '/admin/compte', label: 'Utilisateurs système', icon: UserCog, superOnly: true, section: 'Système' },
  { href: '/admin/parametres', label: 'Paramètres du processus', icon: SlidersHorizontal, superOnly: true, section: 'Système' },
];

function visibleNavItems(
  role: string,
  permissions: Record<string, string> | null | undefined,
  crmAccess: { allLeads: boolean; manageLeads: boolean } | null | undefined,
): AdminNavItem[] {
  const isFullAccess = role === 'ADMIN' || role === 'SUPER_ADMIN';
  return NAV_ITEMS.filter((item) => {
    if (item.alwaysVisible) return true;
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
    isStaffRole(user.role);
  if (!isAdmin) {
    return <AdminLoginScreen />;
  }

  return (
    <AdminShell navItems={visibleNavItems(user.role, user.permissions ?? null, user.crmAccess)}>{children}</AdminShell>
  );
}
