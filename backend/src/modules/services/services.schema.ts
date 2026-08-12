import { z } from 'zod';

// Formulaire "Demander" générique — sert le catalogue de services
// entrepreneuriaux, les tarifs d'espaces et les formules d'abonnement (même
// endpoint, discriminé par targetType). Réservé aux membres connectés
// (requireAuth côté route, cf. services.routes.ts) — le mode "invité" a été
// retiré suite au retour QA (E2E#3/#5) : une demande de service/espace sans
// être connecté n'est plus autorisée.
export const createInquirySchema = z
  .object({
    targetType: z.enum(['SERVICE', 'SPACE', 'PLAN']).default('SERVICE'),
    serviceId: z.string().min(1).optional(),
    spaceId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
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
  });
