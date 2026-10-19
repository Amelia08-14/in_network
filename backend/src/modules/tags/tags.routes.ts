import { Router } from 'express';
import { z } from 'zod';
import { TagCategory } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { validate } from '../../middleware/validate';

const querySchema = z.object({
  category: z.nativeEnum(TagCategory).optional(),
  search: z.string().optional(),
  // all=1 : tout le référentiel (sélecteur groupé du profil), sans plafond de 50.
  all: z.enum(['1', 'true']).optional(),
});

export const tagsRouter = Router();

// Compétences / secteurs : autocomplete, filtres de l'annuaire et référentiel
// complet groupé par famille pour le sélecteur du profil (cf. prisma/taxonomy.ts).
tagsRouter.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const { category, search, all } = req.validatedQuery as z.infer<typeof querySchema>;
    const tags = await prisma.tag.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search ? { label: { contains: search } } : {}),
      },
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
      take: all ? 1500 : 50,
    });
    ok(res, tags);
  }),
);
