import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { createContactMessageSchema } from './contact.schema';

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
    ok(res, message, 201);
  }),
);
