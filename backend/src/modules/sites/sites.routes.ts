import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';

export const sitesRouter = Router();

// V1 : un seul site actif (Hydra, Alger) — cf. CDC §4, note d'évolutivité multi-site.
sitesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sites = await prisma.site.findMany({ where: { isActive: true } });
    ok(res, sites);
  }),
);

// Galerie photo du lieu (locaux/équipe) — alimentée depuis le dashboard admin.
sitesRouter.get(
  '/:id/gallery',
  asyncHandler(async (req, res) => {
    const images = await prisma.galleryImage.findMany({
      where: { ownerType: 'SITE', ownerId: req.params.id },
      orderBy: { order: 'asc' },
    });
    ok(res, images);
  }),
);
