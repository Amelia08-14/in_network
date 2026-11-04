import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { SupportDepartment, SupportThreadStatus } from '../../generated/prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import * as support from './support.service';

// Plafond d'envoi par compte : décourage le spam sans gêner une vraie conversation.
const sendLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  message: { error: { code: 'RATE_LIMITED', message: 'Vous écrivez trop vite, patientez un instant.' } },
});

const body = z.string().trim().min(1, 'Écrivez un message').max(4000, '4 000 caractères maximum');
const subject = z.string().trim().min(2, 'Indiquez un objet').max(150, '150 caractères maximum');
const messageSchema = z.object({ body });
const newThreadSchema = z.object({ department: z.nativeEnum(SupportDepartment), subject, body });

// ============ Espace membre : /api/support ============
// Ouvert même avant le premier paiement : c'est souvent là qu'on a besoin de l'équipe.
export const supportMemberRouter = Router();
supportMemberRouter.use(requireAuth, requireRole('MEMBER'));

supportMemberRouter.get('/departments', (_req, res) => ok(res, support.listDepartments()));
supportMemberRouter.get('/unread-count', asyncHandler(async (req, res) => ok(res, { count: await support.memberUnreadCount(req.user!.id) })));
supportMemberRouter.get('/threads', asyncHandler(async (req, res) => ok(res, await support.listMemberThreads(req.user!.id))));
supportMemberRouter.post(
  '/threads',
  sendLimit,
  validate({ body: newThreadSchema }),
  asyncHandler(async (req, res) => ok(res, await support.createMemberThread(req.user!.id, req.body), 201)),
);
supportMemberRouter.get('/threads/:id', asyncHandler(async (req, res) => ok(res, await support.getMemberThread(req.user!.id, param(req, 'id')))));
supportMemberRouter.post(
  '/threads/:id/messages',
  sendLimit,
  validate({ body: messageSchema }),
  asyncHandler(async (req, res) => ok(res, await support.memberReply(req.user!.id, param(req, 'id'), req.body.body), 201)),
);

// ============ Backoffice : /api/admin/support ============
// Monté par admin.routes.ts (requireAuth + adminPermission, ressource « home ») :
// chaque compte ne voit que les services de son rôle (support.service.ts).
export const supportAdminRouter = Router();

const listQuerySchema = z.object({
  department: z.nativeEnum(SupportDepartment).optional(),
  status: z.nativeEnum(SupportThreadStatus).optional(),
  search: z.string().max(120).optional(),
});
const staffThreadSchema = newThreadSchema.extend({ memberId: z.string().min(1) });
const statusSchema = z.object({ status: z.nativeEnum(SupportThreadStatus) });

supportAdminRouter.get('/unread-count', asyncHandler(async (req, res) => ok(res, { count: await support.staffUnreadCount(req.user!.role) })));
supportAdminRouter.get(
  '/threads',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await support.listStaffThreads(req.user!.role, req.validatedQuery as z.infer<typeof listQuerySchema>))),
);
supportAdminRouter.post(
  '/threads',
  validate({ body: staffThreadSchema }),
  asyncHandler(async (req, res) => ok(res, await support.createStaffThread({ id: req.user!.id, role: req.user!.role }, req.body), 201)),
);
supportAdminRouter.get('/threads/:id', asyncHandler(async (req, res) => ok(res, await support.getStaffThread(req.user!.role, param(req, 'id')))));
supportAdminRouter.post(
  '/threads/:id/messages',
  validate({ body: messageSchema }),
  asyncHandler(async (req, res) => ok(res, await support.staffReply({ id: req.user!.id, role: req.user!.role }, param(req, 'id'), req.body.body), 201)),
);
supportAdminRouter.patch(
  '/threads/:id',
  validate({ body: statusSchema }),
  asyncHandler(async (req, res) => ok(res, await support.setThreadStatus(req.user!.role, param(req, 'id'), req.body.status))),
);
supportAdminRouter.get(
  '/members',
  asyncHandler(async (req, res) => ok(res, await support.searchMembers(typeof req.query.q === 'string' ? req.query.q : ''))),
);
