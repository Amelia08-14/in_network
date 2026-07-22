import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, okPaginated, buildPaginationMeta, ApiError } from '../../utils/apiResponse';
import { validate } from '../../middleware/validate';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
});

export const expertsRouter = Router();

expertsRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query as unknown as z.infer<typeof listQuerySchema>;

    const where = {
      isPublic: true,
      user: { isActive: true },
      ...(search ? { expertiseArea: { contains: search } } : {}),
    };

    const [total, experts] = await Promise.all([
      prisma.expertProfile.count({ where }),
      prisma.expertProfile.findMany({
        where,
        include: { user: { include: { profile: true } } },
        orderBy: { isVerified: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = experts.map((e) => ({
      id: e.id,
      expertiseArea: e.expertiseArea,
      servicesOffered: e.servicesOffered,
      hourlyRate: e.hourlyRate,
      isVerified: e.isVerified,
      firstName: e.user.profile?.firstName,
      lastName: e.user.profile?.lastName,
      avatarUrl: e.user.profile?.avatarUrl,
      companyName: e.user.profile?.companyName,
    }));

    okPaginated(res, data, buildPaginationMeta(page, limit, total));
  }),
);

expertsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { include: { profile: true } } },
    });
    if (!expert || !expert.isPublic) throw ApiError.notFound('Expert introuvable');

    ok(res, {
      id: expert.id,
      expertiseArea: expert.expertiseArea,
      servicesOffered: expert.servicesOffered,
      hourlyRate: expert.hourlyRate,
      isVerified: expert.isVerified,
      firstName: expert.user.profile?.firstName,
      lastName: expert.user.profile?.lastName,
      avatarUrl: expert.user.profile?.avatarUrl,
      bio: expert.user.profile?.bio,
      companyName: expert.user.profile?.companyName,
    });
  }),
);
