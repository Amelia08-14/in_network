import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError, ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import { addMemberDocument } from '../crm/fulfilment.service';
import { logActivity } from '../crm/leads.service';
import { documentFieldsSchema, referentBodySchema } from '../crm/crm.schema';
import { STAFF_SELECT, notifyUsers, staffName } from '../crm/staff';
import { documentAbsolutePath, documentUpload } from '../situation/proofs.storage';
import { removeFileQuietly } from '../situation/situation.service';
import { getMyHistory, listMyServices } from './memberSpace.service';

// Fiche membre côté équipe (processus v1.3, phase 7) — monté sous
// /api/admin/member-services (bloc de droits « fulfilment ») : la fiche lead
// devenue fiche membre, avec son panier de services, son historique, ses
// documents et son référent.
export const memberAdminRouter = Router();

memberAdminRouter.get(
  '/documents/:id/file',
  asyncHandler(async (req, res) => {
    const document = await prisma.memberDocument.findUnique({ where: { id: param(req, 'id') } });
    if (!document) throw ApiError.notFound('Document introuvable');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(documentAbsolutePath(document.filePath));
  }),
);

memberAdminRouter.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const userId = param(req, 'userId');
    const member = await prisma.user.findFirst({
      where: { id: userId, role: 'MEMBER' },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
        referent: { select: STAFF_SELECT },
        profile: { select: { firstName: true, lastName: true, companyName: true, memberType: true, isPublic: true, avatarUrl: true, city: true, idDocumentName: true, idDocumentUploadedAt: true } },
        company: { select: { id: true, name: true, seatLimit: true } },
        memberLeads: {
          select: { id: true, reference: true, title: true, kind: true, stage: true, circuit: true, pipeline: true, channel: true, source: true, salesAgent: { select: STAFF_SELECT }, createdAt: true, wonAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!member) throw ApiError.notFound('Membre introuvable');
    const [services, history] = await Promise.all([listMyServices(userId), getMyHistory(userId)]);
    ok(res, { member, services, history });
  }),
);

memberAdminRouter.patch(
  '/:userId/referent',
  validate({ body: referentBodySchema }),
  asyncHandler(async (req, res) => {
    const userId = param(req, 'userId');
    const referent = req.body.referentId ? await prisma.user.findUnique({ where: { id: req.body.referentId }, select: { ...STAFF_SELECT, isActive: true } }) : null;
    if (req.body.referentId && (!referent || !referent.isActive || referent.role === 'MEMBER')) throw ApiError.badRequest('Choisissez un compte de l’équipe.');
    await prisma.user.update({ where: { id: userId }, data: { referentId: referent?.id ?? null } });
    const lead = await prisma.lead.findFirst({ where: { userId, stage: 'PAID' }, orderBy: { wonAt: 'asc' }, select: { id: true } });
    if (lead) await logActivity(lead.id, { content: referent ? `Référent membre : ${staffName(referent)}.` : 'Référent membre retiré.', authorId: req.user!.id });
    if (referent) {
      await notifyUsers([userId], 'referent_assigned', 'Votre référent', `${staffName(referent)} est votre interlocuteur IN NETWORK.`, '/dashboard');
      if (referent.id !== req.user!.id) await notifyUsers([referent.id], 'referent_assigned_staff', 'Nouveau membre suivi', 'Vous êtes désormais le référent de ce membre.', `/admin/membres/${userId}`);
    }
    ok(res, { referent });
  }),
);

memberAdminRouter.post(
  '/:userId/documents',
  documentUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Joignez le document (PDF ou image).');
    const cleaned = Object.fromEntries(Object.entries(req.body ?? {}).filter(([, value]) => value !== '' && value != null));
    const parsed = documentFieldsSchema.safeParse(cleaned);
    if (!parsed.success) {
      removeFileQuietly(documentAbsolutePath(req.file.filename));
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Informations invalides');
    }
    try {
      ok(res, await addMemberDocument({ userId: param(req, 'userId'), ...parsed.data }, req.file, req.user!.id), 201);
    } catch (error) {
      removeFileQuietly(documentAbsolutePath(req.file.filename));
      throw error;
    }
  }),
);
