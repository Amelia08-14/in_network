import { z } from 'zod';

// Permissions backoffice granulaires (demande client 07/09/2026).
// SUPER_ADMIN et ADMIN ont un accès total ; OFFICE_MANAGER, SALES_MANAGER
// (responsable commercial) et SALES_AGENT (commercial) sont bornés par
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
  { key: 'crm_all', label: 'CRM — voir les leads de toute l’équipe (sinon : ses leads assignés)' },
  { key: 'crm_manage', label: 'CRM — qualifier, valider et assigner les leads' },
  { key: 'quotes', label: 'Devis' },
  { key: 'invoices', label: 'Factures' },
  { key: 'fulfilment', label: 'Lancement des services' },
] as const;

export type DashboardResource = (typeof DASHBOARD_RESOURCES)[number]['key'];

const RESOURCE_KEYS = DASHBOARD_RESOURCES.map((r) => r.key) as [DashboardResource, ...DashboardResource[]];

// Objet de permissions accepté à la création / modification d'un compte staff.
export const dashboardPermissionsSchema = z.record(
  z.enum(RESOURCE_KEYS),
  z.enum(['read', 'write']),
);

// Associe le 1er segment du chemin (relatif à /api/admin) à une ressource.
const PREFIX_TO_RESOURCE: Record<string, DashboardResource | 'system_users'> = {
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
  'system-users': 'system_users',
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

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'OFFICE_MANAGER' | 'SALES_MANAGER' | 'SALES_AGENT';

export const STAFF_ROLES: StaffRole[] = ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT'];
/** Comptes à droits bornés par User.permissions (les deux autres ont tout). */
export const PERMISSION_BOUND_ROLES: StaffRole[] = ['OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT'];

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  OFFICE_MANAGER: 'Office Manager',
  SALES_MANAGER: 'Responsable commercial',
  SALES_AGENT: 'Commercial',
};

// Droits proposés à la création d'un compte (modifiables ensuite). Un
// commercial n'a ni validation de leads, ni vue d'équipe, ni facturation.
export const ROLE_PRESETS: Record<StaffRole, DashboardPermissions> = {
  SUPER_ADMIN: {},
  ADMIN: {},
  OFFICE_MANAGER: {},
  SALES_MANAGER: {
    crm: 'write',
    quotes: 'write',
    invoices: 'read',
    fulfilment: 'read',
    service_requests: 'read',
    contact: 'read',
  },
  SALES_AGENT: { crm: 'write', quotes: 'write' },
};

export const isFullAccessRole = (role: string) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const isStaffRole = (role: string): role is StaffRole => (STAFF_ROLES as string[]).includes(role);
export const isPermissionBoundRole = (role: string) => (PERMISSION_BOUND_ROLES as string[]).includes(role);

/**
 * Le compte a-t-il ce droit ? ADMIN / SUPER_ADMIN : toujours. Les droits
 * transverses du CRM (crm_all, crm_manage) sont implicites pour le responsable
 * commercial et l'office manager qui ont accès au CRM.
 */
export function hasResourceAccess(role: string, perms: DashboardPermissions, key: DashboardResource): boolean {
  if (isFullAccessRole(role)) return true;
  if (!isStaffRole(role)) return false;
  if ((key === 'crm_all' || key === 'crm_manage') && (role === 'SALES_MANAGER' || role === 'OFFICE_MANAGER') && perms.crm) {
    return true;
  }
  return Boolean(perms[key]);
}
