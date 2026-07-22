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
