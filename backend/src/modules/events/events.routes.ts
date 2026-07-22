import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';

export const eventsRouter = Router();

// Événements (CDC §1.2 module 10)
eventsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const events = await prisma.event.findMany({
      where: { isPublished: true },
      include: { _count: { select: { registrations: true } } },
      orderBy: { startAt: 'asc' },
    });
    ok(res, events);
  }),
);

eventsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { registrations: true } } },
    });
    if (!event || !event.isPublished) throw ApiError.notFound('Événement introuvable');
    ok(res, event);
  }),
);

eventsRouter.post(
  '/:id/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!event || !event.isPublished) throw ApiError.notFound('Événement introuvable');

    if (event._count.registrations >= event.capacity) {
      throw ApiError.conflict('Cet événement est complet');
    }

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.user.id } },
    });
    if (existing) throw ApiError.conflict('Tu es déjà inscrit à cet événement');

    const registration = await prisma.eventRegistration.create({
      data: { eventId: event.id, userId: req.user.id },
    });
    ok(res, registration, 201);
  }),
);

eventsRouter.get(
  '/registrations/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const registrations = await prisma.eventRegistration.findMany({
      where: { userId: req.user.id },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, registrations);
  }),
);
