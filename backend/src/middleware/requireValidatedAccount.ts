import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/apiResponse';
import { isAccountValidated } from '../modules/situation/accountState';

// Garde-fou : réservations, souscriptions et mises en relation ne sont ouvertes
// qu'aux comptes validés par l'équipe. Les demandes de devis, elles, restent
// possibles avant validation (c'est ainsi qu'un nouveau membre démarre).
// Le code `ACCOUNT_PENDING` permet au frontend d'orienter vers « Situation ».
export async function requireValidatedAccount(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role !== 'MEMBER') {
    next();
    return;
  }
  if (!(await isAccountValidated(req.user.id))) {
    throw new ApiError(
      403,
      'ACCOUNT_PENDING',
      'Votre compte doit d’abord être validé par l’équipe IN NETWORK. Suivez son avancement dans « Situation du compte ».',
    );
  }
  next();
}
