import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/apiResponse';
import {
  parsePermissions,
  permissionSatisfies,
  resolveRequiredPermission,
} from '../modules/admin/permissions';

// Contrôle d'accès du backoffice (demande client 07/09/2026).
// - SUPER_ADMIN / ADMIN : accès total, aucun contrôle supplémentaire.
// - OFFICE_MANAGER : chaque route /api/admin/* est associée à une ressource ;
//   l'accès exige User.permissions["<ressource>"] au niveau requis
//   (GET => read, write sinon). La gestion des comptes staff (system-users)
//   reste réservée à SUPER_ADMIN / ADMIN.
export async function adminPermission(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw ApiError.unauthorized();

  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    next();
    return;
  }

  // Seul OFFICE_MANAGER passe requireRole en plus des deux ci-dessus.
  const subPath = req.path.replace(/^\/api\/admin/, '');
  const { resource, level } = resolveRequiredPermission(req.method, subPath);

  if (!resource || resource === 'system_users') {
    throw new ApiError(403, 'FORBIDDEN', 'Cette section est réservée aux administrateurs.');
  }

  const account = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { permissions: true, isActive: true },
  });
  if (!account || !account.isActive) throw ApiError.unauthorized();

  const perms = parsePermissions(account.permissions);
  if (!permissionSatisfies(perms[resource], level)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      level === 'read'
        ? 'Vous n’avez pas accès à cette section.'
        : 'Vous n’avez pas les droits de modification sur cette section.',
    );
  }

  next();
}
