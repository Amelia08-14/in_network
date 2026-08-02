import { z } from 'zod';

// Formulaire "Demander" générique — sert le catalogue de services
// entrepreneuriaux, les tarifs d'espaces et les formules d'abonnement (même
// endpoint, discriminé par targetType). Le contrôle "userId (auth) OU
// guestName+guestEmail" est fait dans le handler, pas ici : il dépend de
// l'état d'authentification, pas du seul corps de la requête.
export const createInquirySchema = z
  .object({
    targetType: z.enum(['SERVICE', 'SPACE', 'PLAN']).default('SERVICE'),
    serviceId: z.string().min(1).optional(),
    spaceId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    guestName: z.string().min(1).max(120).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().max(30).optional(),
    guestCompany: z.string().max(160).optional(),
  })
  .superRefine((data, ctx) => {
    const targetField = data.targetType === 'SERVICE' ? 'serviceId' : data.targetType === 'SPACE' ? 'spaceId' : 'planId';
    if (!data[targetField]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${targetField} requis pour une demande de type ${data.targetType}`,
        path: [targetField],
      });
    }
    if (data.guestEmail && !data.guestName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'guestName requis avec guestEmail', path: ['guestName'] });
    }
  });
