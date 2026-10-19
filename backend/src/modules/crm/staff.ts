import { prisma } from '../../lib/prisma';
import { hasResourceAccess, parsePermissions, STAFF_ROLES, type DashboardResource } from '../admin/permissions';

// Comptes du backoffice : ADMIN / SUPER_ADMIN ont tous les droits ; OFFICE_MANAGER,
// SALES_MANAGER (responsable commercial) et SALES_AGENT (commercial) seulement
// ceux de User.permissions.

export const STAFF_SELECT = { id: true, displayName: true, email: true, role: true } as const;

export async function listStaff() {
  return prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, isActive: true },
    select: STAFF_SELECT,
    orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
  });
}

/** Comptes staff qui ont ce droit (ex. `crm_manage`) — destinataires des alertes. */
export async function listStaffWith(resource: DashboardResource) {
  const users = await prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, isActive: true },
    select: { ...STAFF_SELECT, permissions: true },
  });
  return users.filter((user) => hasResourceAccess(user.role, parsePermissions(user.permissions), resource));
}

export const staffName = (user: { displayName: string | null; email: string }) => user.displayName || user.email;

/** Crée une notification par destinataire ; `href` = page ouverte au clic dans la cloche. */
export async function notifyUsers(userIds: string[], type: string, title: string, body: string, href?: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, type, title, body, href: href ?? null })) });
}
