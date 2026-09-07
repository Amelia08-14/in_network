import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/apiResponse';
import { getProfileCompleteness } from '../modules/profiles/profiles.service';

// Garde-fou (demande client 07/09/2026) : une action engageante (souscription,
// demande de service, réservation d'espace, mise en relation) exige un profil
// membre complet. Le code d'erreur `PROFILE_INCOMPLETE` permet au frontend
// d'afficher un message dédié + un lien vers /dashboard/profil.
// Express 5 transmet automatiquement une promesse rejetée à l'error handler.
export async function requireCompleteProfile(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw ApiError.unauthorized();

  // Les comptes staff (ADMIN / SUPER_ADMIN / rôles système) ne sont pas
  // concernés — ils n'ont pas de profil membre à compléter.
  if (req.user.role !== 'MEMBER') {
    next();
    return;
  }

  const { isComplete, missing } = await getProfileCompleteness(req.user.id);
  if (!isComplete) {
    throw new ApiError(
      403,
      'PROFILE_INCOMPLETE',
      'Complétez votre profil avant de poursuivre.',
      { missing },
    );
  }

  next();
}
