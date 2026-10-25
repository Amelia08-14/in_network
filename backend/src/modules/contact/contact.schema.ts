import { z } from 'zod';
import { attributionSchema } from '../crm/attribution';

export const createContactMessageSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  // Sujet choisi dans la liste réglée par le super administrateur.
  subject: z.string().trim().max(120).optional(),
  message: z.string().min(1).max(4000),
  attribution: attributionSchema.optional(),
});
