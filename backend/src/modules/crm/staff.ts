import { prisma } from '../../lib/prisma';
import { parsePermissions, type DashboardResource } from '../admin/permissions';

// Comptes du backoffice (équipe commerciale unique) : ADMIN / SUPER_ADMIN ont
// tous les droits, un OFFICE_MANAGER seulement ceux de User.permissions.

export const STAFF_SELECT = { id: true, displayName: true, email: true, role: true } as const;

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER'] as const;

export async function listStaff() {
  return prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, isActive: true },
    select: STAFF_SELECT,
    orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
  });
}

/** Comptes staff autorisés à lire une ressource (ex. `crm`) — destinataires des alertes. */
export async function listStaffWith(resource: DashboardResource) {
  const users = await prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, isActive: true },
    select: { ...STAFF_SELECT, permissions: true },
  });
  return users.filter(
    (user) => user.role !== 'OFFICE_MANAGER' || Boolean(parsePermissions(user.permissions)[resource]),
  );
}

export const staffName = (user: { displayName: string | null; email: string }) => user.displayName || user.email;

export async function notifyUsers(userIds: string[], type: string, title: string, body: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, type, title, body })) });
}
