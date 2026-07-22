import { z } from 'zod';

// CDC §6.2 — schéma de création tel que spécifié dans le CDC technique
export const createBookingSchema = z
  .object({
    spaceId: z.string().min(1),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endAt'],
  });

export const updateBookingSchema = z.object({
  status: z.literal('CANCELLED'),
});
