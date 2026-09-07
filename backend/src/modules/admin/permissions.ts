import { z } from 'zod';

// Permissions backoffice granulaires (demande client 07/09/2026).
// SUPER_ADMIN et ADMIN ont un accès total ; OFFICE_MANAGER est borné par
// User.permissions = { "<resource>": "read" | "write" }.

export type PermissionLevel = 'read' | 'write';
export type DashboardPermissions = Partial<Record<DashboardResource, PermissionLevel>>;

export const DASHBOARD_RESOURCES = [
  { key: 'stats', label: 'Statistiques & vue d’ensemble' },
  { key: 'validations', label: 'Validations' },
  { key: 'members', label: 'Membres' },
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
