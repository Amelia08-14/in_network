import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { createContactMessageSchema } from './contact.schema';
import { createLeadFromContactMessage } from '../crm/leadIntake.service';

export const contactRouter = Router();

// Formulaire /contact — pas de compte, pas de cible (contrairement à
// ServiceRequest) : un message simple, rate-limité comme les autres
// formulaires publics.
contactRouter.post(
  '/',
  inquiryRateLimit,
  validate({ body: createContactMessageSchema }),
  asyncHandler(async (req, res) => {
    const { attribution, ...fields } = req.body;
    const message = await prisma.contactMessage.create({ data: fields });
    // Chaque message devient un lead à aiguiller, avec son origine (réseau, campagne).
    await createLeadFromContactMessage(message.id, attribution).catch((err) => console.error('[crm] lead non créé', err));
    ok(res, message, 201);
  }),
);
