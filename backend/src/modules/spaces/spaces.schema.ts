import { z } from 'zod';
import { SpaceType } from '../../generated/prisma/client';

export const listSpacesQuerySchema = z.object({
  siteId: z.string().optional(),
  type: z.nativeEnum(SpaceType).optional(),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu: YYYY-MM-DD'),
});
