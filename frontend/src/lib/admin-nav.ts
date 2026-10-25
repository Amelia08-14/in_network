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
import type { AdminNavItem } from '@/components/layout/AdminShell';

// `resource` = clé de permission (cf. types DASHBOARD_RESOURCES) utilisée
// pour masquer l'entrée aux OFFICE_MANAGER sans le droit correspondant.
// `superOnly` = visible seulement pour ADMIN / SUPER_ADMIN.
export type NavEntry = AdminNavItem & {
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
export const NAV_ITEMS: NavEntry[] = [
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


/** Rubriques que le super administrateur peut masquer (pas l'accueil, son compte ni les réglages). */
export const HIDEABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.alwaysVisible && !item.superOnly);

/** La page affichée correspond-elle à une rubrique masquée ? */
export const isHiddenPath = (pathname: string, hidden: string[]) =>
  HIDEABLE_NAV_ITEMS.some(
    (item) => hidden.includes(item.href) && [item.href, ...(item.alsoMatch ?? [])].some((p) => pathname === p || (p !== '/admin' && pathname.startsWith(`${p}/`))),
  );
