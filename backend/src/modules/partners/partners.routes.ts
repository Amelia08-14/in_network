import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';

export const partnersRouter = Router();

// Partenaires (fiche : nom, logo, secteur d'activité — cf. document éléments à transmettre)
partnersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const partners = await prisma.partner.findMany({
      where: { isPublished: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    ok(res, partners);
  }),
);

partnersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!partner || !partner.isPublished) throw ApiError.notFound('Partenaire introuvable');
    ok(res, partner);
  }),
);
