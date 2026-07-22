import { z } from 'zod';

export const createServiceRequestSchema = z.object({
  serviceId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});
