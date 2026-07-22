import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
});
