import { z } from 'zod';

// Permissions backoffice granulaires (demande client 07/09/2026).
// SUPER_ADMIN et ADMIN (la Direction) ont un accès total ; OFFICE_MANAGER,
// SALES_MANAGER (responsable commercial), SALES_AGENT (commercial) et
// ADMIN_SUPPORT (support administratif, processus v1.3) sont bornés par
// User.permissions = { "<resource>": "read" | "write" } — l'administrateur
// décide, compte par compte, ce que chaque rôle voit et modifie (les rôles
// commerciaux reçoivent seulement des droits par défaut, cf. ROLE_PRESETS).

export type PermissionLevel = 'read' | 'write';
export type DashboardPermissions = Partial<Record<DashboardResource, PermissionLevel>>;

export const DASHBOARD_RESOURCES = [
  { key: 'stats', label: 'Statistiques & vue d’ensemble' },
  { key: 'validations', label: 'Validations' },
  { key: 'members', label: 'Membres' },
  { key: 'companies', label: 'Entreprises' },
  { key: 'service_requests', label: 'Demandes de service' },
  { key: 'services', label: 'Catalogue de services' },
  { key: 'bookings', label: 'Réservations' },
  { key: 'payments', label: 'Paiements' },
  { key: 'events', label: 'Événements' },
  { key: 'experts', label: 'Experts' },
  { key: 'partners', label: 'Partenaires' },
  { key: 'testimonials', label: 'Témoignages' },
  { key: 'galerie', label: 'Galerie du lieu & sites' },
  { key: 'spaces', label: 'Espaces' },
  { key: 'plans', label: 'Formules d’abonnement' },
  { key: 'contact', label: 'Messages de contact' },
  { key: 'crm', label: 'CRM commercial (leads, pipeline, agenda)' },
  // Droits « transverses » du CRM — vérifiés par le service, pas par une route.
  // Le responsable commercial et l'office manager les ont d'office (dès qu'ils
  // ont accès au CRM) ; on peut les accorder à un autre compte.
  { key: 'crm_all', label: 'CRM — voir les leads des deux circuits (sinon : selon le rôle)' },
  { key: 'crm_manage', label: 'CRM — aiguiller les leads entrants et attribuer ceux du circuit 1' },
  { key: 'quotes', label: 'Devis' },
  { key: 'invoices', label: 'Factures, proformas et justificatifs' },
  { key: 'fulfilment', label: 'Services clients (activation, livraison, échéances)' },
  { key: 'commissions', label: 'Commissions (lecture : les siennes ; modification : contrôle)' },
] as const;

export type DashboardResource = (typeof DASHBOARD_RESOURCES)[number]['key'];

// Catalogue (services, formules, tarifs des espaces) : créé et modifié par la
// Direction seulement (demande client 25/10/2026). Les comptes bornés peuvent au
// plus le consulter, même si un droit « modification » leur a été coché.
export const DIRECTION_ONLY_WRITE: DashboardResource[] = ['services', 'plans', 'spaces'];

const RESOURCE_KEYS = DASHBOARD_RESOURCES.map((r) => r.key) as [DashboardResource, ...DashboardResource[]];

// Objet de permissions accepté à la création / modification d'un compte staff.
export const dashboardPermissionsSchema = z.record(
  z.enum(RESOURCE_KEYS),
  z.enum(['read', 'write']),
);

// Associe le 1er segment du chemin (relatif à /api/admin) à une ressource.
const PREFIX_TO_RESOURCE: Record<string, DashboardResource | 'system_users' | 'home'> = {
  stats: 'stats',
  validations: 'validations',
  members: 'members',
  companies: 'companies',
  'service-requests': 'service_requests',
  services: 'services',
  bookings: 'bookings',
  payments: 'payments',
  events: 'events',
  experts: 'experts',
  partners: 'partners',
  testimonials: 'testimonials',
  sites: 'galerie',
  spaces: 'spaces',
  plans: 'plans',
  'contact-messages': 'contact',
  crm: 'crm',
  quotes: 'quotes',
  invoices: 'invoices',
  'payment-proofs': 'invoices',
  'service-orders': 'fulfilment',
  'member-services': 'fulfilment',
  commissions: 'commissions',
  'system-users': 'system_users',
  // Paramètres du processus : réservés aux administrateurs, comme les comptes.
  settings: 'system_users',
  // Page d'accueil « Ma journée » : ouverte à tout le staff, chaque bloc est
  // calculé selon les droits du compte (cf. crm/home.service.ts).
  home: 'home',
};

export function resolveRequiredPermission(method: string, path: string) {
  const firstSegment = path.replace(/^\/+/, '').split('/')[0] ?? '';
  const resource = PREFIX_TO_RESOURCE[firstSegment] ?? null;
  const level: PermissionLevel = method === 'GET' || method === 'HEAD' ? 'read' : 'write';
  return { resource, level };
}

export function permissionSatisfies(
  granted: PermissionLevel | undefined,
  required: PermissionLevel,
): boolean {
  if (!granted) return false;
  if (required === 'read') return granted === 'read' || granted === 'write';
  return granted === 'write';
}

export function parsePermissions(value: unknown): DashboardPermissions {
  const result = dashboardPermissionsSchema.safeParse(value);
  return result.success ? (result.data as DashboardPermissions) : {};
}

// --- Rôles du backoffice ------------------------------------------------------

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'OFFICE_MANAGER' | 'SALES_MANAGER' | 'SALES_AGENT' | 'ADMIN_SUPPORT';

export const STAFF_ROLES: StaffRole[] = ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'ADMIN_SUPPORT'];
/** Comptes à droits bornés par User.permissions (les deux autres ont tout). */
export const PERMISSION_BOUND_ROLES: StaffRole[] = ['OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'ADMIN_SUPPORT'];

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Direction',
  OFFICE_MANAGER: 'Office Manager',
  SALES_MANAGER: 'Responsable commercial',
  SALES_AGENT: 'Commercial',
  ADMIN_SUPPORT: 'Support administratif',
};

// Droits proposés à la création d'un compte (modifiables ensuite), alignés sur
// les rôles du processus v1.3. Un commercial n'aiguille pas, ne voit pas
// l'autre circuit et ne facture pas ; le support administratif ne voit que les
// services à livrer de son pôle.
export const ROLE_PRESETS: Record<StaffRole, DashboardPermissions> = {
  SUPER_ADMIN: {},
  ADMIN: {},
  OFFICE_MANAGER: {
    stats: 'read',
    members: 'write',
    companies: 'read',
    service_requests: 'write',
    contact: 'write',
    bookings: 'write',
    events: 'write',
    crm: 'write',
    quotes: 'write',
    invoices: 'write',
    fulfilment: 'write',
    commissions: 'read',
  },
  SALES_MANAGER: {
    crm: 'write',
    quotes: 'write',
    invoices: 'read',
    fulfilment: 'read',
    service_requests: 'read',
    contact: 'read',
    commissions: 'write',
  },
  SALES_AGENT: { crm: 'write', quotes: 'write', commissions: 'read' },
  ADMIN_SUPPORT: { fulfilment: 'write' },
};

export const isFullAccessRole = (role: string) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const isStaffRole = (role: string): role is StaffRole => (STAFF_ROLES as string[]).includes(role);
export const isPermissionBoundRole = (role: string) => (PERMISSION_BOUND_ROLES as string[]).includes(role);

/**
 * Le compte a-t-il ce droit ? ADMIN / SUPER_ADMIN : toujours. Le droit
 * d'aiguiller (crm_manage) est implicite pour le responsable commercial et
 * l'office manager qui ont accès au CRM. La vue des deux circuits (crm_all)
 * ne l'est plus depuis le processus v1.3 : chacun voit son circuit (scope.ts),
 * l'administrateur peut l'accorder compte par compte.
 */
export function hasResourceAccess(role: string, perms: DashboardPermissions, key: DashboardResource): boolean {
  if (isFullAccessRole(role)) return true;
  if (!isStaffRole(role)) return false;
  if (key === 'crm_manage' && (role === 'SALES_MANAGER' || role === 'OFFICE_MANAGER') && perms.crm) {
    return true;
  }
  return Boolean(perms[key]);
}
