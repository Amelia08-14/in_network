import { Router } from 'express';
import { z } from 'zod';
import { EventOrigin } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { validate } from '../../middleware/validate';

export const eventsRouter = Router();

const listQuerySchema = z.object({
  origin: z.nativeEnum(EventOrigin).optional(),
});

// Événements (CDC §1.2 module 10) — 3 catégories : IN EVENT (interne), externe, co-organisé
eventsRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { origin } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED', ...(origin ? { origin } : {}) },
      include: {
        _count: { select: { registrations: true } },
      },
      orderBy: { startAt: 'asc' },
    });
    const gallery = await attachGalleries(events.map((e) => e.id));
    ok(res, events.map((e) => ({ ...e, gallery: gallery[e.id] ?? [] })));
  }),
);

// Galerie agrégée de tous les événements publiés (photos + vidéos) — doit
// être déclarée avant /:slug pour ne pas être capturée comme un slug.
eventsRouter.get(
  '/gallery',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { origin } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED', ...(origin ? { origin } : {}) },
      orderBy: { startAt: 'desc' },
    });
    const galleryByEvent = await attachGalleries(events.map((e) => e.id));

    type MediaItem = {
      id: string;
      type: 'image' | 'video';
      url: string;
      altText: string | null;
      eventId: string;
      eventTitle: string;
      eventSlug: string;
      eventOrigin: EventOrigin;
    };
    const items: MediaItem[] = [];
    for (const event of events) {
      const base = { eventId: event.id, eventTitle: event.title, eventSlug: event.slug, eventOrigin: event.origin };
      const seenUrls = new Set<string>();
      if (event.videoUrl) {
        items.push({ id: `${event.id}-video`, type: 'video', url: event.videoUrl, altText: event.title, ...base });
        seenUrls.add(event.videoUrl);
      }
      if (event.coverImage && !seenUrls.has(event.coverImage)) {
        items.push({ id: `${event.id}-cover`, type: 'image', url: event.coverImage, altText: event.title, ...base });
        seenUrls.add(event.coverImage);
      }
      for (const img of galleryByEvent[event.id] ?? []) {
        if (seenUrls.has(img.url)) continue;
        seenUrls.add(img.url);
        items.push({ id: img.id, type: 'image', url: img.url, altText: img.altText, ...base });
      }
    }
    ok(res, items);
  }),
);

eventsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { registrations: true } } },
    });
    if (!event || event.status !== 'PUBLISHED') throw ApiError.notFound('Événement introuvable');
    const gallery = await prisma.galleryImage.findMany({
      where: { ownerType: 'EVENT', ownerId: event.id },
      orderBy: { order: 'asc' },
    });
    ok(res, { ...event, gallery });
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
    if (!event || event.status !== 'PUBLISHED') throw ApiError.notFound('Événement introuvable');

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

async function attachGalleries(eventIds: string[]): Promise<Record<string, { id: string; url: string; altText: string | null; order: number }[]>> {
  if (eventIds.length === 0) return {};
  const images = await prisma.galleryImage.findMany({
    where: { ownerType: 'EVENT', ownerId: { in: eventIds } },
    orderBy: { order: 'asc' },
  });
  return images.reduce<Record<string, typeof images>>((acc, img) => {
    (acc[img.ownerId] ??= []).push(img);
    return acc;
  }, {});
}
