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
  addEventImageSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  createExpertSchema,
  updateExpertSchema,
  createPartnerSchema,
  updatePartnerSchema,
  updateBookingStatusSchema,
  addSiteImageSchema,
  updateContactMessageSchema,
  replyContactMessageSchema,
} from './admin.schema';
import { sendEmail } from '../../lib/email';

export const adminRouter = Router();

// Toutes les routes admin sont réservées à ADMIN / SUPER_ADMIN (CDC §7.2)
adminRouter.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

// --- Statistiques (vue d'ensemble backoffice, CDC §1.2 module 12) ---
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const [
      totalMembers,
      newMembers,
      activeSubscriptions,
      upcomingBookings,
      revenue,
      recentPayments,
      recentMembers,
      bookingsWithSpace,
      eventsWithRegistrations,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.user.count({ where: { role: 'MEMBER', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: new Date() } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED', paidAt: { gte: twelveMonthsAgo } },
        select: { amount: true, paidAt: true },
      }),
      prisma.user.findMany({
        where: { role: 'MEMBER', createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true },
      }),
      prisma.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: { space: { select: { name: true } } },
      }),
      prisma.event.findMany({
        where: { status: 'PUBLISHED' },
        select: { title: true, _count: { select: { registrations: true } } },
        orderBy: { registrations: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    ok(res, {
      totalMembers,
      newMembersLast30Days: newMembers,
      activeSubscriptions,
      upcomingBookings,
      totalRevenue: revenue._sum.amount ?? 0,
      revenueByMonth: bucketByMonth(recentPayments, (p) => p.paidAt, (p) => Number(p.amount)),
      newMembersByMonth: bucketByMonth(recentMembers, (m) => m.createdAt, () => 1),
      bookingsBySpace: countBy(bookingsWithSpace, (b) => b.space?.name ?? 'Autre'),
      topEvents: eventsWithRegistrations.map((e) => ({ title: e.title, registrations: e._count.registrations })),
    });
  }),
);

function bucketByMonth<T>(items: T[], getDate: (item: T) => Date | null, getValue: (item: T) => number) {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
  }
  for (const item of items) {
    const date = getDate(item);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + getValue(item));
  }
  return Array.from(buckets.entries()).map(([month, value]) => ({ month, value }));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

// --- Validations (hub central : événements/services/paiements en attente) ---
adminRouter.get(
  '/validations',
  asyncHandler(async (_req, res) => {
    const [pendingEvents, pendingServiceRequests, pendingBankTransfers] = await Promise.all([
      prisma.event.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { startAt: 'asc' } }),
      prisma.serviceRequest.findMany({
        where: { status: 'NEW' },
        include: { user: { include: { profile: true } }, service: true, space: true, plan: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING', method: 'BANK_TRANSFER' },
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    ok(res, { pendingEvents, pendingServiceRequests, pendingBankTransfers });
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
adminRouter.post(
  '/contact-messages/:id/reply',
  validate({ body: replyContactMessageSchema }),
  asyncHandler(async (req, res) => {
    const message = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
    if (!message) throw ApiError.notFound('Message introuvable');

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[char] ?? char);

    await sendEmail({
      to: message.email,
      subject: 'Réponse de l’équipe IN NETWORK',
      html: `<p>Bonjour ${escapeHtml(message.name)},</p><p>${escapeHtml(req.body.reply).replace(/\n/g, '<br>')}</p><p>L’équipe IN NETWORK</p>`,
    });

    const updated = await prisma.contactMessage.update({
      where: { id: message.id },
      data: { replyText: req.body.reply, repliedAt: new Date(), isRead: true },
    });
    ok(res, updated);
  }),
);
adminRouter.delete(
  '/contact-messages/:id',
  asyncHandler(async (req, res) => {
    await prisma.contactMessage.delete({ where: { id: req.params.id } });
    res.status(204).send();
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
// Confirmer/annuler une demande de location d'espace (CDC — gestion des
// réservations depuis le dashboard admin).
adminRouter.patch(
  '/bookings/:id',
  validate({ body: updateBookingStatusSchema }),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      include: { user: { include: { profile: true } }, space: true },
    });
    ok(res, booking);
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

// --- Galerie du lieu (photos locaux/équipe, affichées sur la home) ---
adminRouter.get(
  '/sites/:id/images',
  asyncHandler(async (req, res) => {
    const images = await prisma.galleryImage.findMany({
      where: { ownerType: 'SITE', ownerId: req.params.id },
      orderBy: { order: 'asc' },
    });
    ok(res, images);
  }),
);
adminRouter.post(
  '/sites/:id/images',
  validate({ body: addSiteImageSchema }),
  asyncHandler(async (req, res) => {
    const image = await prisma.galleryImage.create({
      data: { ...req.body, ownerType: 'SITE', ownerId: req.params.id },
    });
    ok(res, image, 201);
  }),
);
adminRouter.delete(
  '/sites/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    await prisma.galleryImage.delete({ where: { id: req.params.imageId } });
    ok(res, { id: req.params.imageId });
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
        include: { user: { include: { profile: true } }, service: true, space: true, plan: true },
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
    ok(
      res,
      await prisma.event.findMany({
        orderBy: { startAt: 'desc' },
        include: { _count: { select: { registrations: true } } },
      }),
    );
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
adminRouter.get(
  '/events/:id/images',
  asyncHandler(async (req, res) => {
    const images = await prisma.galleryImage.findMany({
      where: { ownerType: 'EVENT', ownerId: req.params.id },
      orderBy: { order: 'asc' },
    });
    ok(res, images);
  }),
);
adminRouter.post(
  '/events/:id/images',
  validate({ body: addEventImageSchema }),
  asyncHandler(async (req, res) => {
    const image = await prisma.galleryImage.create({
      data: { ...req.body, ownerType: 'EVENT', ownerId: req.params.id },
    });
    ok(res, image, 201);
  }),
);
adminRouter.delete(
  '/events/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    await prisma.galleryImage.delete({ where: { id: req.params.imageId } });
    ok(res, { id: req.params.imageId });
  }),
);

// --- Experts (annuaire) ---
adminRouter.get(
  '/experts',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.expertProfile.findMany({ orderBy: [{ order: 'asc' }, { displayName: 'asc' }] }));
  }),
);
adminRouter.post(
  '/experts',
  validate({ body: createExpertSchema }),
  asyncHandler(async (req, res) => {
    const expert = await prisma.expertProfile.create({ data: req.body });
    ok(res, expert, 201);
  }),
);
adminRouter.patch(
  '/experts/:id',
  validate({ body: updateExpertSchema }),
  asyncHandler(async (req, res) => {
    const expert = await prisma.expertProfile.update({ where: { id: req.params.id }, data: req.body });
    ok(res, expert);
  }),
);
adminRouter.delete(
  '/experts/:id',
  asyncHandler(async (req, res) => {
    await prisma.expertProfile.delete({ where: { id: req.params.id } });
    ok(res, { id: req.params.id });
  }),
);

// --- Partenaires ---
adminRouter.get(
  '/partners',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.partner.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }));
  }),
);
adminRouter.post(
  '/partners',
  validate({ body: createPartnerSchema }),
  asyncHandler(async (req, res) => {
    const partner = await prisma.partner.create({ data: req.body });
    ok(res, partner, 201);
  }),
);
adminRouter.patch(
  '/partners/:id',
  validate({ body: updatePartnerSchema }),
  asyncHandler(async (req, res) => {
    const partner = await prisma.partner.update({ where: { id: req.params.id }, data: req.body });
    ok(res, partner);
  }),
);
adminRouter.delete(
  '/partners/:id',
  asyncHandler(async (req, res) => {
    await prisma.partner.delete({ where: { id: req.params.id } });
    ok(res, { id: req.params.id });
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

// --- Messages de contact (formulaire /contact) ---
adminRouter.get(
  '/contact-messages',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const [total, messages] = await Promise.all([
      prisma.contactMessage.count(),
      prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    okPaginated(res, messages, buildPaginationMeta(page, limit, total));
  }),
);
adminRouter.patch(
  '/contact-messages/:id',
  validate({ body: updateContactMessageSchema }),
  asyncHandler(async (req, res) => {
    const message = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: req.body,
    });
    ok(res, message);
  }),
);
