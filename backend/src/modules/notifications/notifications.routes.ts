import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';

// Cloche de notifications — commune au back-office et à l'espace membre : chaque
// compte ne lit que les siennes (nouveau lead à qualifier, lead assigné, message,
// mise en relation…). Jusqu'ici elles étaient créées mais n'étaient affichées nulle part.
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, type: true, title: true, body: true, href: true, isRead: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    ok(res, { unread, items });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    ok(res, { success: true });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    // Idempotent : déjà lue, inconnue ou appartenant à un autre compte → rien à faire.
    await prisma.notification.updateMany({ where: { id: param(req, 'id'), userId: req.user!.id }, data: { isRead: true } });
    ok(res, { success: true });
  }),
);
