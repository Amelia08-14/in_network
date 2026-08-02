import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';

export const plansRouter = Router();

// CDC §1.4 — grille tarifaire réelle transmise par la cliente (cf. seed.ts)
plansRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    ok(res, plans);
  }),
);
