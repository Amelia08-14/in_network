import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiResponse';
import { identityAbsolutePath, identityUpload } from '../situation/proofs.storage';
import { getCommunityShowcase, getIdDocumentFile, removeIdentityFile, setIdDocument } from './profiles.service';
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
// Vitrine publique (accueil) : chiffres réels + aperçu limité, sans coordonnées.
// Déclarée avant /:id pour ne pas être lue comme un identifiant.
profilesRouter.get(
  '/showcase',
  asyncHandler(async (_req, res) => ok(res, await getCommunityShowcase())),
);
profilesRouter.put('/me', requireAuth, validate({ body: updateProfileSchema }), updateMyProfileHandler);
// Pièce d'identité (complétude du profil) : fichier privé, envoyé et relu par le membre seul.
profilesRouter.post(
  '/me/id-document',
  requireAuth,
  identityUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Joignez le scan de votre pièce d’identité (PDF ou image).');
    try {
      ok(res, await setIdDocument(req.user!.id, req.file));
    } catch (error) {
      removeIdentityFile(req.file.filename);
      throw error;
    }
  }),
);
profilesRouter.get(
  '/me/id-document',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await getIdDocumentFile(req.user!.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(identityAbsolutePath(file.filePath));
  }),
);
profilesRouter.get('/:id', requireAuth, getProfileHandler);
