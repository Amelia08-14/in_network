import { Prisma, type Role, type SalesProfile } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { generatePassword, sendCredentialsEmail } from '../../lib/account-provisioning';
import { ApiError } from '../../utils/apiResponse';
import {
  isPermissionBoundRole,
  parsePermissions,
  ROLE_PRESETS,
  STAFF_ROLES as ALL_STAFF_ROLES,
  type DashboardPermissions,
  type StaffRole,
} from './permissions';

// Comptes « Utilisateurs système » (demande client 07/09/2026) : équipe
// backoffice avec rôles + permissions. Le mot de passe est généré ici et
// envoyé par email — il n'est jamais choisi par le créateur ni renvoyé en clair
// dans la réponse API (seulement dans l'email au destinataire).

const STAFF_ROLES: Role[] = [...ALL_STAFF_ROLES];

/** Rôles que l'on peut attribuer depuis /admin/compte (le super admin n'est pas créable ici). */
export type AssignableRole = Exclude<StaffRole, 'SUPER_ADMIN'>;

const SAFE_SELECT = {
  id: true,
  email: true,
  role: true,
  permissions: true,
  displayName: true,
  salesProfile: true,
  isExternal: true,
  isActive: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

function sendStaffCredentials(to: string, name: string, password: string, isReset: boolean) {
  sendCredentialsEmail({
    to,
    name,
    password,
    loginPath: '/admin',
    subject: isReset
      ? 'IN NETWORK — Nouveau mot de passe backoffice'
      : 'IN NETWORK — Vos accès au backoffice',
    intro: isReset
      ? 'Le mot de passe de votre accès à l’administration IN NETWORK vient d’être réinitialisé.'
      : 'Un accès à l’administration IN NETWORK vient d’être créé pour vous.',
  });
}

export async function listSystemUsers() {
  return prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: SAFE_SELECT,
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

interface CreateInput {
  email: string;
  displayName: string;
  phone?: string;
  role: AssignableRole;
  permissions?: DashboardPermissions;
  salesProfile?: SalesProfile | null;
  isExternal?: boolean;
  actorRole: Role;
}

export async function createSystemUser(input: CreateInput) {
  if (input.role === 'ADMIN' && input.actorRole !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Seul un super administrateur peut créer un compte administrateur.');
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('Un compte existe déjà avec cet email.');

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      displayName: input.displayName,
      phone: input.phone,
      // Sédentaire / terrain : n'a de sens que pour un commercial.
      salesProfile: input.role === 'SALES_AGENT' ? (input.salesProfile ?? null) : null,
      isExternal: input.isExternal ?? false,
      emailVerified: new Date(),
      // Droits fournis par l'administrateur, à défaut ceux proposés pour le rôle.
      permissions: isPermissionBoundRole(input.role) ? (input.permissions ?? ROLE_PRESETS[input.role]) : undefined,
    },
    select: SAFE_SELECT,
  });

  sendStaffCredentials(input.email, input.displayName, password, false);

  return user;
}

export async function resetSystemUserPassword(targetId: string, actorId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, displayName: true },
  });
  if (!target || !STAFF_ROLES.includes(target.role)) throw ApiError.notFound('Compte introuvable.');
  if (target.role === 'SUPER_ADMIN' && target.id !== actorId) {
    throw ApiError.forbidden('Le mot de passe d’un super administrateur ne se réinitialise pas ici.');
  }

  const password = generatePassword();
  await prisma.user.update({ where: { id: targetId }, data: { passwordHash: await hashPassword(password) } });

  // Par sécurité : coupe les sessions actives ailleurs (comme changePassword).
  await prisma.refreshToken.updateMany({
    where: { userId: targetId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  sendStaffCredentials(target.email, target.displayName ?? target.email, password, true);
}

interface UpdateInput {
  targetId: string;
  actorId: string;
  actorRole: Role;
  role?: AssignableRole;
  permissions?: DashboardPermissions;
  isActive?: boolean;
  displayName?: string;
  salesProfile?: SalesProfile | null;
  isExternal?: boolean;
}

export async function updateSystemUser(input: UpdateInput) {
  const target = await prisma.user.findUnique({
    where: { id: input.targetId },
    select: { id: true, role: true },
  });
  if (!target || !STAFF_ROLES.includes(target.role)) throw ApiError.notFound('Compte introuvable.');

  if (target.id === input.actorId) {
    throw ApiError.forbidden('Vous ne pouvez pas modifier votre propre compte ici.');
  }
  if (target.role === 'SUPER_ADMIN') {
    throw ApiError.forbidden('Un compte super administrateur ne se modifie pas depuis cette interface.');
  }
  if (input.role === 'ADMIN' && input.actorRole !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Seul un super administrateur peut promouvoir un compte en administrateur.');
  }

  const nextRole = input.role ?? target.role;
  return prisma.user.update({
    where: { id: input.targetId },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.isExternal === undefined ? {} : { isExternal: input.isExternal }),
      ...(nextRole !== 'SALES_AGENT' ? { salesProfile: null } : input.salesProfile === undefined ? {} : { salesProfile: input.salesProfile }),
      ...(input.permissions !== undefined || input.role
        ? { permissions: isPermissionBoundRole(nextRole) ? parsePermissions(input.permissions ?? ROLE_PRESETS[nextRole as StaffRole]) : Prisma.JsonNull }
        : {}),
    },
    select: SAFE_SELECT,
  });
}

export async function deleteSystemUser(targetId: string, actorId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target || !STAFF_ROLES.includes(target.role)) throw ApiError.notFound('Compte introuvable.');
  if (target.id === actorId) throw ApiError.forbidden('Vous ne pouvez pas supprimer votre propre compte.');
  if (target.role === 'SUPER_ADMIN') throw ApiError.forbidden('Un compte super administrateur ne peut pas être supprimé ici.');

  // Un compte staff peut porter des ServiceRequest assignées / Notifications ;
  // on nettoie le minimum non-cascade puis on supprime (profil en cascade).
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: targetId } }),
    prisma.serviceRequest.updateMany({ where: { assignedAdminId: targetId }, data: { assignedAdminId: null } }),
    prisma.user.delete({ where: { id: targetId } }),
  ]);
}
