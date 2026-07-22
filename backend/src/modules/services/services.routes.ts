import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { createServiceRequestSchema } from './services.schema';

export const servicesRouter = Router();

// Catalogue de services entrepreneuriaux (CDC §1.2 module 7)
servicesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.serviceCatalogItem.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });
    ok(res, items);
  }),
);

servicesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.findUnique({ where: { slug: req.params.slug } });
    if (!item || !item.isActive) throw ApiError.notFound('Service introuvable');
    ok(res, item);
  }),
);

servicesRouter.get(
  '/requests/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const requests = await prisma.serviceRequest.findMany({
      where: { userId: req.user.id },
      include: { service: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, requests);
  }),
);

servicesRouter.post(
  '/requests',
  requireAuth,
  validate({ body: createServiceRequestSchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const service = await prisma.serviceCatalogItem.findUnique({ where: { id: req.body.serviceId } });
    if (!service || !service.isActive) throw ApiError.notFound('Service introuvable');

    const request = await prisma.serviceRequest.create({
      data: { userId: req.user.id, serviceId: service.id, notes: req.body.notes },
    });
    ok(res, request, 201);
  }),
);
