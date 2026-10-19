import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireValidatedAccount } from '../../middleware/requireValidatedAccount';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import * as messages from './messages.service';

export const messagesRouter = Router();

// Plafond d'envoi par compte : décourage le spam sans gêner une vraie conversation.
const sendLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  message: { error: { code: 'RATE_LIMITED', message: 'Vous écrivez trop vite, patientez un instant.' } },
});

const sendSchema = z.object({ body: z.string().trim().min(1, 'Écrivez un message').max(2000, '2 000 caractères maximum') });

messagesRouter.use(requireAuth, requireValidatedAccount);

messagesRouter.get('/unread-count', asyncHandler(async (req, res) => ok(res, { count: await messages.unreadCount(req.user!.id) })));
messagesRouter.get('/conversations', asyncHandler(async (req, res) => ok(res, await messages.listConversations(req.user!.id))));
messagesRouter.get('/conversations/:id', asyncHandler(async (req, res) => ok(res, await messages.getThread(req.user!.id, param(req, 'id')))));
messagesRouter.post(
  '/conversations/:id/messages',
  sendLimit,
  validate({ body: sendSchema }),
  asyncHandler(async (req, res) => ok(res, await messages.sendMessage(req.user!.id, param(req, 'id'), req.body.body), 201)),
);
