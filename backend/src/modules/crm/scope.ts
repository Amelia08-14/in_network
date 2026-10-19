import type { NextFunction, Request, Response } from 'express';
import type { Prisma, Role } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { hasResourceAccess, parsePermissions } from '../admin/permissions';

// Portée des données commerciales (demande client 19/10/2026) : un commercial
// ne voit que les leads qui lui sont assignés — et, par extension, leurs devis,
// factures, rendez-vous, journal et commandes. Le responsable commercial et
// l'office manager voient tout ; l'administrateur peut accorder « crm_all » à un
// autre compte. La qualification / validation / assignation des leads suit
// le droit « crm_manage ».

export interface StaffScope {
  userId: string;
  role: Role;
  /** Voit les leads de toute l'équipe. */
  allLeads: boolean;
  /** Peut qualifier, valider, assigner et réassigner. */
  manageLeads: boolean;
}

export async function loadScope(userId: string, role: Role): Promise<StaffScope> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true, isActive: true } });
  if (!account || !account.isActive) throw ApiError.unauthorized();
  const perms = parsePermissions(account.permissions);
  return {
    userId,
    role,
    allLeads: hasResourceAccess(role, perms, 'crm_all'),
    manageLeads: hasResourceAccess(role, perms, 'crm_manage'),
  };
}

/** Middleware : charge la portée du compte connecté dans req.scope. */
export async function attachScope(req: Request, _res: Response, next: NextFunction) {
  try {
    req.scope = await loadScope(req.user!.id, req.user!.role);
    next();
  } catch (error) {
    next(error);
  }
}

export const requireScope = (req: Request): StaffScope => {
  if (!req.scope) throw ApiError.unauthorized();
  return req.scope;
};

/** Filtre Prisma sur les leads visibles (undefined = tous). */
export const leadScopeWhere = (scope: StaffScope | undefined): Prisma.LeadWhereInput | undefined =>
  !scope || scope.allLeads ? undefined : { assignedToId: scope.userId };

/** 404 (et non 403 : on ne révèle pas l'existence) si le lead n'est pas dans la portée. */
export async function assertLeadAccess(scope: StaffScope | undefined, leadId: string | null | undefined) {
  if (!scope || scope.allLeads) return;
  if (!leadId) throw ApiError.notFound('Introuvable');
  const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedToId: scope.userId }, select: { id: true } });
  if (!lead) throw ApiError.notFound('Introuvable');
}

export function assertCanManage(scope: StaffScope | undefined) {
  if (scope && !scope.manageLeads) {
    throw ApiError.forbidden('Seul le responsable commercial peut qualifier, valider et assigner les leads.');
  }
}
