import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, okPaginated, buildPaginationMeta, ApiError } from '../../utils/apiResponse';
import * as paymentsService from '../payments/payments.service';
import {
  listQuerySchema,
  toggleActiveSchema,
  createSpaceSchema,
  updateSpaceSchema,
  createPlanSchema,
  updatePlanSchema,
  createServiceCatalogSchema,
  updateServiceCatalogSchema,
  updateServiceRequestSchema,
  createEventSchema,
  updateEventSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
} from './admin.schema';

export const adminRouter = Router();

// Toutes les routes admin sont réservées à ADMIN / SUPER_ADMIN (CDC §7.2)
adminRouter.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

// --- Statistiques (vue d'ensemble backoffice, CDC §1.2 module 12) ---
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalMembers, newMembers, activeSubscriptions, upcomingBookings, revenue] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.user.count({ where: { role: 'MEMBER', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: new Date() } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);

    ok(res, {
      totalMembers,
      newMembersLast30Days: newMembers,
      activeSubscriptions,
      upcomingBookings,
      totalRevenue: revenue._sum.amount ?? 0,
    });
  }),
);

// --- Membres ---
adminRouter.get(
  '/members',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
    };
    const where = {
      role: 'MEMBER' as const,
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { profile: { firstName: { contains: search } } },
              { profile: { lastName: { contains: search } } },
            ],
          }
        : {}),
    };
    const [total, members] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    okPaginated(
      res,
      members.map(({ passwordHash, emailVerifyToken, passwordResetToken, ...safe }) => safe),
      buildPaginationMeta(page, limit, total),
    );
  }),
);

adminRouter.get(
  '/members/:id',
  asyncHandler(async (req, res) => {
    const member = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { profile: true, expertProfile: true, subscriptions: true, bookings: true },
    });
    if (!member) throw ApiError.notFound('Membre introuvable');
    const { passwordHash, emailVerifyToken, passwordResetToken, ...safe } = member;
    ok(res, safe);
  }),
);

adminRouter.patch(
  '/members/:id',
  validate({ body: toggleActiveSchema }),
  asyncHandler(async (req, res) => {
    const member = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
    });
    ok(res, { id: member.id, isActive: member.isActive });
  }),
);

// --- Réservations ---
adminRouter.get(
  '/bookings',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const [total, bookings] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.findMany({
        include: { user: { include: { profile: true } }, space: true },
        orderBy: { startAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    okPaginated(res, bookings, buildPaginationMeta(page, limit, total));
  }),
);

// --- Espaces ---
adminRouter.get(
  '/spaces',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.spaceResource.findMany({ orderBy: { name: 'asc' } }));
  }),
);
adminRouter.post(
  '/spaces',
  validate({ body: createSpaceSchema }),
  asyncHandler(async (req, res) => {
    const space = await prisma.spaceResource.create({ data: req.body });
    ok(res, space, 201);
  }),
);
adminRouter.patch(
  '/spaces/:id',
  validate({ body: updateSpaceSchema }),
  asyncHandler(async (req, res) => {
    const space = await prisma.spaceResource.update({ where: { id: req.params.id }, data: req.body });
    ok(res, space);
  }),
);

// --- Formules d'abonnement ---
adminRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.membershipPlan.findMany({ orderBy: { price: 'asc' } }));
  }),
);
adminRouter.post(
  '/plans',
  validate({ body: createPlanSchema }),
  asyncHandler(async (req, res) => {
    const plan = await prisma.membershipPlan.create({ data: req.body });
    ok(res, plan, 201);
  }),
);
adminRouter.patch(
  '/plans/:id',
  validate({ body: updatePlanSchema }),
  asyncHandler(async (req, res) => {
    const plan = await prisma.membershipPlan.update({ where: { id: req.params.id }, data: req.body });
    ok(res, plan);
  }),
);

// --- Paiements ---
adminRouter.get(
  '/payments',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const [total, payments] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.findMany({
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    okPaginated(res, payments, buildPaginationMeta(page, limit, total));
  }),
);
// Confirmation manuelle d'un virement bancaire (CDC §1.4 — fonctionnement
// identique à IN ACADEMY : statut mis à jour manuellement par l'admin)
adminRouter.post(
  '/payments/:id/confirm',
  asyncHandler(async (req, res) => {
    const payment = await paymentsService.markPaymentCompleted(req.params.id);
    ok(res, payment);
  }),
);

// --- Services entrepreneuriaux ---
adminRouter.post(
  '/services',
  validate({ body: createServiceCatalogSchema }),
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.create({ data: req.body });
    ok(res, item, 201);
  }),
);
adminRouter.patch(
  '/services/:id',
  validate({ body: updateServiceCatalogSchema }),
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.update({ where: { id: req.params.id }, data: req.body });
    ok(res, item);
  }),
);
adminRouter.get(
  '/service-requests',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const [total, requests] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.findMany({
        include: { user: { include: { profile: true } }, service: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    okPaginated(res, requests, buildPaginationMeta(page, limit, total));
  }),
);
adminRouter.patch(
  '/service-requests/:id',
  validate({ body: updateServiceRequestSchema }),
  asyncHandler(async (req, res) => {
    const request = await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: req.body,
    });
    ok(res, request);
  }),
);

// --- Événements ---
adminRouter.get(
  '/events',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.event.findMany({ orderBy: { startAt: 'desc' } }));
  }),
);
adminRouter.post(
  '/events',
  validate({ body: createEventSchema }),
  asyncHandler(async (req, res) => {
    const event = await prisma.event.create({ data: req.body });
    ok(res, event, 201);
  }),
);
adminRouter.patch(
  '/events/:id',
  validate({ body: updateEventSchema }),
  asyncHandler(async (req, res) => {
    const event = await prisma.event.update({ where: { id: req.params.id }, data: req.body });
    ok(res, event);
  }),
);

// --- Témoignages ---
adminRouter.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } }));
  }),
);
adminRouter.post(
  '/testimonials',
  validate({ body: createTestimonialSchema }),
  asyncHandler(async (req, res) => {
    const testimonial = await prisma.testimonial.create({ data: req.body });
    ok(res, testimonial, 201);
  }),
);
adminRouter.patch(
  '/testimonials/:id',
  validate({ body: updateTestimonialSchema }),
  asyncHandler(async (req, res) => {
    const testimonial = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: req.body,
    });
    ok(res, testimonial);
  }),
);
