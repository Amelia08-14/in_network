import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, okPaginated, buildPaginationMeta, ApiError } from '../../utils/apiResponse';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { createConnectionRequest } from '../connections/connections.service';
import { param } from '../../utils/httpParams';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
});

export const expertsRouter = Router();

const expertConnectionSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

expertsRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.validatedQuery as z.infer<typeof listQuerySchema>;

    const where = {
      isPublic: true,
      OR: [{ userId: null }, { user: { isActive: true } }],
      ...(search ? { expertiseArea: { contains: search } } : {}),
    };

    const [total, experts] = await Promise.all([
      prisma.expertProfile.count({ where }),
      prisma.expertProfile.findMany({
        where,
        include: { user: { include: { profile: true } } },
        orderBy: [{ order: 'asc' }, { isVerified: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = experts.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      photoUrl: e.photoUrl ?? e.user?.profile?.avatarUrl ?? null,
      bio: e.bio,
      expertiseArea: e.expertiseArea,
      servicesOffered: e.servicesOffered,
      hourlyRate: e.hourlyRate,
      isVerified: e.isVerified,
      companyName: e.user?.profile?.companyName,
    }));

    okPaginated(res, data, buildPaginationMeta(page, limit, total));
  }),
);

expertsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: param(req, 'id') },
      include: { user: { include: { profile: true } } },
    });
    if (!expert || !expert.isPublic) throw ApiError.notFound('Expert introuvable');

    ok(res, {
      id: expert.id,
      displayName: expert.displayName,
      photoUrl: expert.photoUrl ?? expert.user?.profile?.avatarUrl ?? null,
      bio: expert.bio ?? expert.user?.profile?.bio ?? null,
      expertiseArea: expert.expertiseArea,
      servicesOffered: expert.servicesOffered,
      hourlyRate: expert.hourlyRate,
      isVerified: expert.isVerified,
      companyName: expert.user?.profile?.companyName,
    });
  }),
);

expertsRouter.post(
  '/:id/connection-request',
  requireAuth,
  validate({ body: expertConnectionSchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();

    const expert = await prisma.expertProfile.findUnique({ where: { id: param(req, 'id') } });
    if (!expert || !expert.isPublic) throw ApiError.notFound('Expert introuvable');

    if (expert.userId) {
      const request = await createConnectionRequest(req.user.id, expert.userId, req.body.message);
      return ok(res, { request, routedTo: 'EXPERT' }, 201);
    }

    const requester = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true },
    });
    if (!requester) throw ApiError.unauthorized();

    const requesterName = requester.profile
      ? `${requester.profile.firstName} ${requester.profile.lastName}`.trim()
      : requester.email;
    const request = await prisma.contactMessage.create({
      data: {
        name: requesterName,
        email: requester.email,
        message: [
          `Demande de mise en relation avec l'expert ${expert.displayName}.`,
          '',
          req.body.message,
        ].join('\n'),
      },
    });
    const trackedRequest = await prisma.expertConnectionRequest.create({
      data: {
        requesterUserId: req.user.id,
        expertProfileId: expert.id,
        message: req.body.message,
      },
    });

    return ok(res, { request: trackedRequest, routedTo: 'TEAM' }, 201);
  }),
);
