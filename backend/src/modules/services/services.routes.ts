import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { createInquirySchema } from './services.schema';
import { param } from '../../utils/httpParams';

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
    const item = await prisma.serviceCatalogItem.findUnique({ where: { slug: param(req, 'slug') } });
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
      include: { service: true, space: true, plan: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, requests);
  }),
);

// Formulaire "Demander" — catalogue de services, tarif d'espace ou formule
// d'abonnement, discriminé par targetType. Réservé aux membres connectés
// (retour QA E2E#3/#5 : une demande sans compte n'est plus autorisée).
servicesRouter.post(
  '/requests',
  inquiryRateLimit,
  requireAuth,
  validate({ body: createInquirySchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { targetType, serviceId, spaceId, planId, notes } = req.body;

    if (targetType === 'SERVICE') {
      const service = await prisma.serviceCatalogItem.findUnique({ where: { id: serviceId } });
      if (!service || !service.isActive) throw ApiError.notFound('Service introuvable');
    } else if (targetType === 'SPACE') {
      const space = await prisma.spaceResource.findUnique({ where: { id: spaceId } });
      if (!space || !space.isActive) throw ApiError.notFound('Espace introuvable');
    } else {
      const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
      if (!plan || !plan.isActive) throw ApiError.notFound('Formule introuvable');
    }

    const request = await prisma.serviceRequest.create({
      data: {
        userId: req.user.id,
        targetType,
        serviceId: targetType === 'SERVICE' ? serviceId : undefined,
        spaceId: targetType === 'SPACE' ? spaceId : undefined,
        planId: targetType === 'PLAN' ? planId : undefined,
        notes,
      },
    });
    ok(res, request, 201);
  }),
);
