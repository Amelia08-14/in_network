import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError, ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import { invoicePdf } from '../crm/invoices.service';
import { quotePdf } from '../crm/quotes.service';
import { PaymentProofStatus } from '../../generated/prisma/client';
import { proofAbsolutePath, proofUpload } from './proofs.storage';
import * as situation from './situation.service';

function sendPdf(res: Response, file: { number: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.number}.pdf"`);
  res.send(file.buffer);
}

function sendProof(res: Response, proof: { filePath: string; fileName: string; mimeType: string }) {
  res.setHeader('Content-Type', proof.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(proof.fileName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(proofAbsolutePath(proof.filePath));
}

// ============================ Espace membre : /api/member ============================
export const memberRouter = Router();
memberRouter.use(requireAuth);

memberRouter.get('/situation', asyncHandler(async (req, res) => ok(res, await situation.getSituation(req.user!.id))));

memberRouter.post('/quotes/:id/accept', asyncHandler(async (req, res) => {
  await situation.answerQuote(req.user!.id, param(req, 'id'), 'ACCEPTED');
  ok(res, await situation.getSituation(req.user!.id));
}));
memberRouter.post('/quotes/:id/reject', asyncHandler(async (req, res) => {
  await situation.answerQuote(req.user!.id, param(req, 'id'), 'REJECTED');
  ok(res, await situation.getSituation(req.user!.id));
}));

// PDF : uniquement les documents du membre, jamais les brouillons.
memberRouter.get('/quotes/:id/pdf', asyncHandler(async (req, res) => {
  const id = await situation.ownedQuoteId(req.user!.id, param(req, 'id'));
  sendPdf(res, await quotePdf(id));
}));
memberRouter.get('/invoices/:id/pdf', asyncHandler(async (req, res) => {
  const id = await situation.ownedInvoiceId(req.user!.id, param(req, 'id'));
  sendPdf(res, await invoicePdf(id));
}));

const proofFieldsSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  reference: z.string().trim().max(190).optional(),
  amount: z.coerce.number().positive().max(1e10).optional(),
  quoteId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
});

memberRouter.post(
  '/payment-proofs',
  proofUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Joignez votre justificatif (PDF ou image).');
    // Champs multipart : les valeurs vides d'un formulaire valent « absent ».
    const cleaned = Object.fromEntries(Object.entries(req.body ?? {}).filter(([, value]) => value !== '' && value != null));
    const parsed = proofFieldsSchema.safeParse(cleaned);
    if (!parsed.success) {
      situation.removeFileQuietly(proofAbsolutePath(req.file.filename));
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Informations invalides');
    }
    try {
      const proof = await situation.createProof(req.user!.id, req.file, parsed.data);
      ok(res, { id: proof.id, status: proof.status }, 201);
    } catch (error) {
      situation.removeFileQuietly(proofAbsolutePath(req.file.filename));
      throw error;
    }
  }),
);

memberRouter.get('/payment-proofs/:id/file', asyncHandler(async (req, res) => {
  sendProof(res, await situation.getOwnedProofFile(req.user!.id, param(req, 'id')));
}));

// ============================ Backoffice : /api/admin/payment-proofs ============================
// Monté par admin.routes.ts (déjà derrière requireAuth + adminPermission,
// ressource « invoices »).
export const paymentProofsAdminRouter = Router();

const listQuerySchema = z.object({
  status: z.nativeEnum(PaymentProofStatus).optional(),
  userId: z.string().optional(),
});
paymentProofsAdminRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await situation.listProofs(req.validatedQuery as never))),
);
paymentProofsAdminRouter.get('/:id/file', asyncHandler(async (req, res) => {
  sendProof(res, await situation.getProofForStaff(param(req, 'id')));
}));
paymentProofsAdminRouter.post(
  '/:id/review',
  validate({
    body: z.object({
      decision: z.enum(['ACCEPT', 'REJECT']),
      reviewNote: z.string().trim().max(1000).optional(),
      recordPayment: z.boolean().optional(),
      validateAccount: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await situation.reviewProof(param(req, 'id'), req.body, req.user!.id))),
);
