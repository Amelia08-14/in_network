import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { createContactMessageSchema } from './contact.schema';
import { createLeadFromContactMessage } from '../crm/leads.service';

export const contactRouter = Router();

// Formulaire /contact — pas de compte, pas de cible (contrairement à
// ServiceRequest) : un message simple, rate-limité comme les autres
// formulaires publics.
contactRouter.post(
  '/',
  inquiryRateLimit,
  validate({ body: createContactMessageSchema }),
  asyncHandler(async (req, res) => {
    const message = await prisma.contactMessage.create({ data: req.body });
    // Chaque message devient un lead « Nouveau » pour l'équipe commerciale.
    await createLeadFromContactMessage(message.id).catch((err) => console.error('[crm] lead non créé', err));
    ok(res, message, 201);
  }),
);
