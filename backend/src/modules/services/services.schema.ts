import { z } from 'zod';

// Demande de devis sous forme de panier — plusieurs lignes (services du
// catalogue, salles de réunion, formules d'abonnement) dans une même demande.
// Réservé aux membres connectés (requireAuth côté route, cf. services.routes.ts)
// — le mode "invité" a été retiré suite au retour QA (E2E#3/#5). Le client
// n'envoie jamais de prix : libellés et tarifs sont relus en base à l'envoi.
export const MAX_CART_ITEMS = 20;

const cartItemSchema = z.object({
  targetType: z.enum(['SERVICE', 'SPACE', 'PLAN']),
  targetId: z.string().min(1),
  // Palier choisi dans un service à grille (ex. « NET », « Formation … »).
  tierLabel: z.string().min(1).max(200).optional(),
});

export const createInquirySchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Ajoute au moins un service à ta demande').max(MAX_CART_ITEMS),
  notes: z.string().max(2000).optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
