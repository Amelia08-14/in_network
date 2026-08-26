import { Router } from 'express';
import { z } from 'zod';
import { TagCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { validate } from '../../middleware/validate';

const querySchema = z.object({
  category: z.nativeEnum(TagCategory).optional(),
  search: z.string().optional(),
});

export const tagsRouter = Router();

// Autocomplete pour les champs de compétences/secteurs (wizard, filtres annuaire)
tagsRouter.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const { category, search } = req.validatedQuery as z.infer<typeof querySchema>;
    const tags = await prisma.tag.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search ? { label: { contains: search } } : {}),
      },
      orderBy: { label: 'asc' },
      take: 50,
    });
    ok(res, tags);
  }),
);
