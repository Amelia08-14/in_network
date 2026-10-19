import { Router, type NextFunction, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import * as leads from './leads.service';
import * as quotes from './quotes.service';
import * as invoices from './invoices.service';
import * as fulfilment from './fulfilment.service';
import { AUTOMATION_RULES, runAutomations } from './automations.service';
import { listStaff } from './staff';
import { assertCanManage, assertLeadAccess, attachScope, requireScope } from './scope';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import * as s from './crm.schema';

// Routes montées sous /api/admin (cf. admin.routes.ts) : l'accès est déjà
// filtré par adminPermission — `crm`, `quotes`, `invoices` et `fulfilment` sont
// les blocs de permissions de l'équipe commerciale.

function sendPdf(res: Response, file: { number: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.number}.pdf"`);
  res.send(file.buffer);
}

// Chaque routeur commercial charge d'abord la portée du compte (req.scope) :
// un commercial n'accède qu'aux leads qui lui sont assignés et à ce qui s'y
// rattache (devis, factures, rendez-vous, journal, commandes) — cf. scope.ts.
// Pour les ressources désignées par un :id, `guard` vérifie le rattachement avant
// toute autre route ; une ressource hors portée répond 404.
type Resolver = (id: string) => Promise<string | null | undefined>;
const guard =
  (resolve: Resolver, skip: string[] = []) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id ?? '');
      if (id && !skip.includes(id)) await assertLeadAccess(req.scope, await resolve(id));
      next();
    } catch (error) {
      next(error);
    }
  };

// ============================ CRM ============================
export const crmRouter = Router();
crmRouter.use(attachScope);

crmRouter.get('/dashboard', asyncHandler(async (req, res) => ok(res, await leads.getDashboard(requireScope(req)))));
crmRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
crmRouter.get(
  '/search',
  asyncHandler(async (req, res) => ok(res, await leads.globalSearch(String(req.query.q ?? ''), requireScope(req)))),
);

crmRouter.get(
  '/leads',
  validate({ query: s.leadListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as { stage?: never; source?: never; assignee?: string; search?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee === 'none' ? null : q.assignee || undefined;
    ok(res, await leads.listLeads({ stage: q.stage, source: q.source, search: q.search, assignedToId }, requireScope(req)));
  }),
);
crmRouter.post(
  '/leads',
  validate({ body: s.leadBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.createLead(req.body, req.user!.id, requireScope(req)), 201)),
);
crmRouter.get('/leads/:id', asyncHandler(async (req, res) => ok(res, await leads.getLead(param(req, 'id'), requireScope(req)))));
crmRouter.patch(
  '/leads/:id',
  validate({ body: s.leadPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.updateLead(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/stage',
  validate({ body: s.stageBodySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await leads.changeStage(param(req, 'id'), req.body.stage, req.user!.id, req.body.lostReason, requireScope(req))),
  ),
);
// Qualification → validation → assignation : réservées au responsable commercial
// (droit crm_manage, cf. scope.ts).
crmRouter.post(
  '/leads/:id/qualify',
  validate({ body: s.qualifyBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.qualifyLead(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/assign',
  validate({ body: s.assignBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.assignLead(param(req, 'id'), req.body.assignedToId, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/reject',
  validate({ body: s.rejectBodySchema }),
  asyncHandler(async (req, res) => {
    assertCanManage(requireScope(req));
    ok(res, await leads.changeStage(param(req, 'id'), 'LOST', req.user!.id, `Écarté à la qualification : ${req.body.reason}`, requireScope(req)));
  }),
);
crmRouter.post(
  '/leads/:id/activities',
  validate({ body: s.activityBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.addActivity(param(req, 'id'), req.body, req.user!.id, requireScope(req)), 201)),
);
crmRouter.post(
  '/leads/:id/appointments',
  validate({ body: s.appointmentBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.createAppointment(param(req, 'id'), req.body, req.user!.id, requireScope(req)), 201)),
);

crmRouter.get(
  '/activities',
  validate({ query: s.activityListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.listActivities(req.validatedQuery as never, requireScope(req)))),
);

crmRouter.get(
  '/appointments',
  validate({ query: s.appointmentListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.listAppointments(req.validatedQuery as never, requireScope(req)))),
);
crmRouter.patch(
  '/appointments/:id',
  validate({ body: s.appointmentPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.updateAppointment(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.delete(
  '/appointments/:id',
  asyncHandler(async (req, res) => {
    await leads.deleteAppointment(param(req, 'id'), requireScope(req));
    res.status(204).send();
  }),
);

crmRouter.get('/automations/rules', (_req, res) => ok(res, AUTOMATION_RULES));
crmRouter.post(
  '/automations/run',
  asyncHandler(async (req, res) => {
    assertCanManage(requireScope(req));
    ok(res, await runAutomations());
  }),
);

// ============================ Devis ============================
export const quotesRouter = Router();
quotesRouter.use(attachScope);
const manageTemplates = (req: Request, _res: Response, next: NextFunction) => {
  try {
    assertCanManage(requireScope(req));
    next();
  } catch (error) {
    next(error);
  }
};

// Les modèles d'abord : « /templates » ne doit pas être lu comme un :id.
quotesRouter.get('/templates', asyncHandler(async (_req, res) => ok(res, await quotes.listTemplates())));
quotesRouter.post(
  '/templates',
  manageTemplates,
  validate({ body: s.templateBodySchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.createTemplate(req.body), 201)),
);
quotesRouter.patch(
  '/templates/:id',
  manageTemplates,
  validate({ body: s.templatePatchSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.updateTemplate(param(req, 'id'), req.body))),
);
quotesRouter.delete(
  '/templates/:id',
  manageTemplates,
  asyncHandler(async (req, res) => {
    await quotes.deleteTemplate(param(req, 'id'));
    res.status(204).send();
  }),
);

quotesRouter.get(
  '/',
  validate({ query: s.quoteListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.listQuotes(req.validatedQuery as never, requireScope(req)))),
);
quotesRouter.post(
  '/',
  validate({ body: s.quoteCreateSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.createQuote(req.body, req.user!.id, requireScope(req)), 201)),
);
quotesRouter.use(
  '/:id',
  guard(async (id) => (await prisma.quote.findUnique({ where: { id }, select: { leadId: true } }))?.leadId, ['templates']),
);
quotesRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await quotes.getQuote(param(req, 'id')))));
quotesRouter.patch(
  '/:id',
  validate({ body: s.quotePatchSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.updateQuote(param(req, 'id'), req.body))),
);
quotesRouter.post('/:id/send', asyncHandler(async (req, res) => ok(res, await quotes.sendQuote(param(req, 'id'), req.user!.id))));
quotesRouter.post('/:id/accept', asyncHandler(async (req, res) => ok(res, await quotes.decideQuote(param(req, 'id'), 'ACCEPTED', req.user!.id))));
quotesRouter.post('/:id/reject', asyncHandler(async (req, res) => ok(res, await quotes.decideQuote(param(req, 'id'), 'REJECTED', req.user!.id))));
quotesRouter.post('/:id/reopen', asyncHandler(async (req, res) => ok(res, await quotes.reopenQuote(param(req, 'id'), req.user!.id))));
quotesRouter.get('/:id/pdf', asyncHandler(async (req, res) => sendPdf(res, await quotes.quotePdf(param(req, 'id')))));

// ============================ Factures ============================
export const invoicesRouter = Router();
invoicesRouter.use(attachScope);

invoicesRouter.get(
  '/',
  validate({ query: s.invoiceListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.listInvoices(req.validatedQuery as never, requireScope(req)))),
);
invoicesRouter.post(
  '/',
  validate({ body: s.invoiceCreateSchema }),
  asyncHandler(async (req, res) => {
    // Un commercial ne facture que ses propres leads / devis : pas de facture « libre ».
    const scope = requireScope(req);
    if (!scope.allLeads) {
      const leadId =
        req.body.leadId ?? (req.body.quoteId ? (await prisma.quote.findUnique({ where: { id: req.body.quoteId }, select: { leadId: true } }))?.leadId : null);
      if (!leadId) throw ApiError.forbidden('Rattachez cette facture à l’un de vos leads.');
      await assertLeadAccess(scope, leadId);
    }
    ok(res, await invoices.createInvoice(req.body, req.user!.id), 201);
  }),
);
invoicesRouter.use(
  '/:id',
  guard(async (id) => (await prisma.invoice.findUnique({ where: { id }, select: { leadId: true } }))?.leadId),
);
invoicesRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await invoices.getInvoice(param(req, 'id')))));
invoicesRouter.patch(
  '/:id',
  validate({ body: s.invoicePatchSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.updateInvoice(param(req, 'id'), req.body))),
);
invoicesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await invoices.deleteDraftInvoice(param(req, 'id'));
    res.status(204).send();
  }),
);
invoicesRouter.post(
  '/:id/issue',
  validate({ body: s.invoiceIssueSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.issueInvoice(param(req, 'id'), req.body, req.user!.id))),
);
invoicesRouter.post('/:id/send', asyncHandler(async (req, res) => ok(res, await invoices.sendInvoice(param(req, 'id'), req.user!.id))));
invoicesRouter.post(
  '/:id/payment',
  validate({ body: s.invoicePaymentSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.recordPayment(param(req, 'id'), req.body, req.user!.id))),
);
invoicesRouter.post(
  '/:id/cancel',
  validate({ body: s.invoiceCancelSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.cancelInvoice(param(req, 'id'), req.body.reason, req.user!.id))),
);
invoicesRouter.get('/:id/pdf', asyncHandler(async (req, res) => sendPdf(res, await invoices.invoicePdf(param(req, 'id')))));

// ============================ Lancement des services ============================
export const serviceOrdersRouter = Router();
serviceOrdersRouter.use(attachScope);

serviceOrdersRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
serviceOrdersRouter.get(
  '/',
  validate({ query: s.orderListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as { status?: never; assignee?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee || undefined;
    ok(res, await fulfilment.listOrders({ status: q.status, assignedToId }, requireScope(req)));
  }),
);
// Commande hors portée : ni assignée au compte, ni issue d'un de ses leads.
serviceOrdersRouter.use('/:id', async (req, _res, next) => {
  try {
    const scope = requireScope(req);
    if (scope.allLeads || req.params.id === 'staff') return next();
    const order = await prisma.serviceOrder.findUnique({ where: { id: String(req.params.id) }, select: { assignedToId: true, leadId: true } });
    if (!order) return next(ApiError.notFound('Introuvable'));
    if (order.assignedToId !== scope.userId) await assertLeadAccess(scope, order.leadId);
    next();
  } catch (error) {
    next(error);
  }
});
serviceOrdersRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await fulfilment.getOrder(param(req, 'id')))));
serviceOrdersRouter.patch(
  '/:id',
  validate({ body: s.orderPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await fulfilment.updateOrder(param(req, 'id'), req.body))),
);
serviceOrdersRouter.post(
  '/:id/tasks',
  validate({ body: s.taskBodySchema }),
  asyncHandler(async (req, res) => ok(res, await fulfilment.addTask(param(req, 'id'), req.body.title), 201)),
);
serviceOrdersRouter.patch(
  '/:id/tasks/:taskId',
  validate({ body: s.taskPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await fulfilment.setTaskDone(param(req, 'id'), param(req, 'taskId'), req.body.isDone))),
);
serviceOrdersRouter.delete(
  '/:id/tasks/:taskId',
  asyncHandler(async (req, res) => ok(res, await fulfilment.deleteTask(param(req, 'id'), param(req, 'taskId')))),
);
