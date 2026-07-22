import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { paymentsRateLimit } from '../../middleware/rateLimit';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { paymentGateway } from '../../lib/payments/gateway';
import * as paymentsService from './payments.service';

export const paymentsRouter = Router();

paymentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const payments = await paymentsService.listMyPayments(req.user.id);
    ok(res, payments);
  }),
);

const webhookSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(['completed', 'failed']),
  providerRef: z.string().optional(),
});

// Callback de la passerelle de paiement (Chargily Pay proposé — CDC §9).
// Signature vérifiée avant tout traitement (CDC §11).
paymentsRouter.post(
  '/webhook',
  paymentsRateLimit,
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-chargily-signature'] as string | undefined;
    if (!paymentGateway.verifyWebhookSignature(JSON.stringify(req.body), signature)) {
      throw ApiError.forbidden('Signature de webhook invalide');
    }

    const { paymentId, status, providerRef } = webhookSchema.parse(req.body);

    if (status === 'completed') {
      await paymentsService.markPaymentCompleted(paymentId, providerRef);
    } else {
      await paymentsService.markPaymentFailed(paymentId);
    }

    ok(res, { received: true });
  }),
);
