import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { listProfilesQuerySchema, updateProfileSchema } from './profiles.schema';
import {
  listProfilesHandler,
  getProfileHandler,
  getMyProfileHandler,
  updateMyProfileHandler,
} from './profiles.controller';

export const profilesRouter = Router();

// Retour brief client (§3.1) : l'annuaire redevient privé — réservé aux
// utilisateurs authentifiés, plus d'accès visiteur (attachUserIfPresent
// laissait passer un visiteur non connecté avec un jeu de champs réduit ;
// ça correspondait à un annuaire "public" que le client ne veut plus).
// Défense en profondeur : le frontend gate déjà /annuaire dans
// middleware.ts, cette vérification serveur est la barrière réelle.
profilesRouter.get(
  '/',
  requireAuth,
  validate({ query: listProfilesQuerySchema }),
  listProfilesHandler,
);
profilesRouter.get('/me', requireAuth, getMyProfileHandler);
profilesRouter.put('/me', requireAuth, validate({ body: updateProfileSchema }), updateMyProfileHandler);
profilesRouter.get('/:id', requireAuth, getProfileHandler);
