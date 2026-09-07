import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { notifyFormSubmission } from '../../lib/email';
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

    // Relais vers la boîte de réception des formulaires (non bloquant : un
    // aléa SMTP ne doit pas faire échouer l'enregistrement du message).
    notifyFormSubmission({
      formTitle: 'Formulaire de contact',
      replyTo: message.email,
      fields: [
        { label: 'Nom', value: message.name },
        { label: 'Email', value: message.email },
        { label: 'Message', value: message.message },
      ],
    }).catch((err) => console.error('[contact] échec relais email de la soumission', err));

    ok(res, message, 201);
  }),
);
