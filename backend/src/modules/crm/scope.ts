import type { NextFunction, Request, Response } from 'express';
import type { LeadCircuit, Prisma, Role } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { hasResourceAccess, isFullAccessRole, parsePermissions, type DashboardPermissions } from '../admin/permissions';

// Portée des données commerciales — processus v1.3 (23/10/2026).
//   Direction (administrateurs) et comptes « crm_all » : tous les leads.
//   Responsable commercial : les leads du circuit 1 (Sales Team).
//   Office Manager : le circuit 2, et les dossiers du circuit 1 qui lui ont été
//     transmis après la visite.
//   Commercial : ses leads ; après la transmission à l'Office Manager, il garde
//     un accès en lecture (il en est le closer).
//   Les comptes qui aiguillent (droit « crm_manage ») voient aussi les leads
//   encore sans circuit.
// Les devis, factures, rendez-vous, journal et commandes suivent la portée de
// leur lead.

export interface StaffScope {
  userId: string;
  role: Role;
  /** Voit tous les leads (Direction, ou droit crm_all). */
  allLeads: boolean;
  /** Aiguille les leads entrants et attribue ceux du circuit 1 (droit crm_manage). */
  manageLeads: boolean;
  /** Pilote la Sales Team : voit et gère le circuit 1. */
  salesManager: boolean;
  /** Pilote le circuit 2 et reçoit les dossiers transmis. */
  officeManager: boolean;
  /** Direction : valide les devis sur mesure du circuit 2 et les commissions. */
  direction: boolean;
}

/** Rôle du compte dans le processus — partagé avec /auth/me pour que l'interface s'adapte (le serveur applique de toute façon). */
export function scopeFlags(role: string, perms: DashboardPermissions): Omit<StaffScope, 'userId' | 'role'> {
  const manageLeads = hasResourceAccess(role, perms, 'crm_manage');
  return {
    allLeads: hasResourceAccess(role, perms, 'crm_all'),
    manageLeads,
    salesManager: role === 'SALES_MANAGER' || (manageLeads && role !== 'OFFICE_MANAGER' && !isFullAccessRole(role)),
    officeManager: role === 'OFFICE_MANAGER',
    direction: isFullAccessRole(role),
  };
}

export async function loadScope(userId: string, role: Role): Promise<StaffScope> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true, isActive: true } });
  if (!account || !account.isActive) throw ApiError.unauthorized();
  return { userId, role, ...scopeFlags(role, parsePermissions(account.permissions)) };
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
export function leadScopeWhere(scope: StaffScope | undefined): Prisma.LeadWhereInput | undefined {
  if (!scope || scope.allLeads) return undefined;
  const visible: Prisma.LeadWhereInput[] = [{ assignedToId: scope.userId }, { salesAgentId: scope.userId }];
  if (scope.manageLeads) visible.push({ circuit: null });
  if (scope.salesManager) visible.push({ circuit: 'SALES_TEAM' });
  if (scope.officeManager) visible.push({ circuit: 'OFFICE_MANAGER' }, { handedOverAt: { not: null } });
  return { OR: visible };
}

/** Restreint un filtre de documents (devis, factures…) aux leads visibles. */
export const viaLeadScope = (scope: StaffScope | undefined) => {
  const scoped = leadScopeWhere(scope);
  return scoped ? { lead: scoped } : {};
};

interface LeadAccessFields {
  circuit: LeadCircuit | null;
  assignedToId: string | null;
  salesAgentId: string | null;
  handedOverAt: Date | null;
}

export function canReadLead(scope: StaffScope | undefined, lead: LeadAccessFields): boolean {
  if (!scope || scope.allLeads) return true;
  if (lead.assignedToId === scope.userId || lead.salesAgentId === scope.userId) return true;
  if (scope.manageLeads && lead.circuit === null) return true;
  if (scope.salesManager && lead.circuit === 'SALES_TEAM') return true;
  if (scope.officeManager && (lead.circuit === 'OFFICE_MANAGER' || lead.handedOverAt)) return true;
  return false;
}

/** Peut agir sur la fiche : l'intervenant en charge, ou le pilote de son circuit. */
export function canWriteLead(scope: StaffScope | undefined, lead: LeadAccessFields): boolean {
  if (!scope || scope.allLeads) return true;
  if (lead.assignedToId === scope.userId) return true;
  // Le commercial garde la main tant que le dossier n'est pas transmis.
  if (lead.salesAgentId === scope.userId && !lead.handedOverAt) return true;
  if (scope.manageLeads && lead.circuit === null) return true;
  if (scope.salesManager && lead.circuit === 'SALES_TEAM' && !lead.handedOverAt) return true;
  if (scope.officeManager && (lead.circuit === 'OFFICE_MANAGER' || lead.handedOverAt)) return true;
  return false;
}

const ACCESS_SELECT = { circuit: true, assignedToId: true, salesAgentId: true, handedOverAt: true } as const;

/**
 * 404 (et non 403 : on ne révèle pas l'existence) si le lead n'est pas visible ;
 * 403 s'il est visible mais en lecture seule pour ce compte.
 */
export async function assertLeadAccess(scope: StaffScope | undefined, leadId: string | null | undefined, mode: 'read' | 'write' = 'write') {
  if (!scope || scope.allLeads) return;
  if (!leadId) throw ApiError.notFound('Introuvable');
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: ACCESS_SELECT });
  if (!lead || !canReadLead(scope, lead)) throw ApiError.notFound('Introuvable');
  if (mode === 'write' && !canWriteLead(scope, lead)) {
    throw ApiError.forbidden('Ce dossier a été transmis : vous le suivez en lecture seule.');
  }
}

export function assertCanManage(scope: StaffScope | undefined) {
  if (scope && !scope.manageLeads) {
    throw ApiError.forbidden('Seuls le responsable commercial et l’Office Manager aiguillent et attribuent les leads.');
  }
}
