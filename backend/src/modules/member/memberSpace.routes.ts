import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireValidatedAccount } from '../../middleware/requireValidatedAccount';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import { documentAbsolutePath } from '../situation/proofs.storage';
import * as space from './memberSpace.service';

// Espace client (processus v1.3) — monté sous /api/member, à côté de
// « Devis et factures » (situation.routes.ts). Tout ce qui suit la vente
// demande un compte actif (déverrouillé au premier paiement).
export const memberSpaceRouter = Router();
memberSpaceRouter.use(requireAuth);

memberSpaceRouter.get('/overview', asyncHandler(async (req, res) => ok(res, await space.getMyOverview(req.user!.id))));

memberSpaceRouter.get('/services', requireValidatedAccount, asyncHandler(async (req, res) => ok(res, await space.listMyServices(req.user!.id))));
memberSpaceRouter.post('/services/:id/validate', requireValidatedAccount, asyncHandler(async (req, res) => ok(res, await space.validateMyService(req.user!.id, param(req, 'id')))));
memberSpaceRouter.post(
  '/services/:id/adjustment',
  requireValidatedAccount,
  validate({ body: z.object({ note: z.string().trim().min(3, 'Décrivez ce qui doit être corrigé').max(2000) }) }),
  asyncHandler(async (req, res) => ok(res, await space.adjustMyService(req.user!.id, param(req, 'id'), req.body.note))),
);
memberSpaceRouter.post('/services/:id/renew', requireValidatedAccount, asyncHandler(async (req, res) => ok(res, await space.renewMyService(req.user!.id, param(req, 'id')))));

memberSpaceRouter.get('/history', requireValidatedAccount, asyncHandler(async (req, res) => ok(res, await space.getMyHistory(req.user!.id))));
memberSpaceRouter.get(
  '/documents/:id/file',
  requireValidatedAccount,
  asyncHandler(async (req, res) => {
    const document = await space.getOwnedDocument(req.user!.id, param(req, 'id'));
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(documentAbsolutePath(document.filePath));
  }),
);

const optionalText = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());
memberSpaceRouter.post(
  '/referrals',
  requireValidatedAccount,
  validate({
    body: z.object({
      contactName: z.string().trim().min(2, 'Indiquez le nom du contact').max(190),
      email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().email('Adresse e-mail invalide').max(190).nullable().optional()),
      phone: optionalText(60),
      companyName: optionalText(190),
      need: optionalText(1000),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await space.referContact(req.user!.id, req.body), 201)),
);
