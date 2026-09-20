import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireCompleteProfile } from '../../middleware/requireCompleteProfile';
import { inquiryRateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { createInquirySchema } from './services.schema';
import { createServiceRequest } from './serviceRequests.service';
import { createLeadFromServiceRequest } from '../crm/leads.service';
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
      include: { items: { orderBy: { createdAt: 'asc' } }, payment: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, requests);
  }),
);

// Envoi du panier de devis — une demande, plusieurs lignes (services du
// catalogue, salles de réunion, formules d'abonnement). Réservé aux membres
// connectés (retour QA E2E#3/#5 : une demande sans compte n'est plus
// autorisée) ; le panier lui-même se remplit sans compte côté navigateur.
servicesRouter.post(
  '/requests',
  inquiryRateLimit,
  requireAuth,
  requireCompleteProfile,
  validate({ body: createInquirySchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { items, notes } = req.body;
    const request = await createServiceRequest(req.user.id, items, notes);
    // La demande alimente le CRM : un lead « Nouveau » est créé pour l'équipe
    // commerciale. Un souci côté CRM ne doit jamais faire échouer l'envoi du client.
    await createLeadFromServiceRequest(request.id).catch((err) => console.error('[crm] lead non créé', err));
    ok(res, request, 201);
  }),
);
