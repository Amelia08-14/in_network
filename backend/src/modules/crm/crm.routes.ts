import { Router, type NextFunction, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import * as leads from './leads.service';
import * as flow from './leadFlow.service';
import * as quotes from './quotes.service';
import * as invoices from './invoices.service';
import * as fulfilment from './fulfilment.service';
import * as commissions from './commissions.service';
import { getCrmDashboard, getHome } from './home.service';
import { AUTOMATION_RULES, runAutomations } from './automations.service';
import { listStaff } from './staff';
import { assertCanManage, assertLeadAccess, attachScope, requireScope } from './scope';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import * as s from './crm.schema';

// Routes montées sous /api/admin (cf. admin.routes.ts) : l'accès est déjà
// filtré par adminPermission — `crm`, `quotes`, `invoices`, `fulfilment` et
// `commissions` sont les blocs de permissions de la chaîne commerciale.

function sendPdf(res: Response, file: { number: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.number}.pdf"`);
  res.send(file.buffer);
}

// Chaque routeur commercial charge d'abord la portée du compte (req.scope),
// cf. scope.ts. Pour les ressources désignées par un :id, `guard` vérifie le
// rattachement au lead avant toute autre route (lecture pour un GET,
// écriture sinon) ; une ressource hors portée répond 404.
type Resolver = (id: string) => Promise<string | null | undefined>;
const guard =
  (resolve: Resolver, skip: string[] = []) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id ?? '');
      if (id && !skip.includes(id)) await assertLeadAccess(req.scope, await resolve(id), req.method === 'GET' ? 'read' : 'write');
      next();
    } catch (error) {
      next(error);
    }
  };

// ============================ Accueil « Ma journée » ============================
// Ouvert à tout le staff (ressource « home ») : chaque bloc est calculé selon les droits.
export const homeRouter = Router();
homeRouter.use(attachScope);
homeRouter.get('/', asyncHandler(async (req, res) => ok(res, await getHome(requireScope(req)))));

// ============================ CRM ============================
export const crmRouter = Router();
crmRouter.use(attachScope);

crmRouter.get('/dashboard', asyncHandler(async (req, res) => ok(res, await getCrmDashboard(requireScope(req)))));
crmRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
crmRouter.get(
  '/search',
  asyncHandler(async (req, res) => ok(res, await leads.globalSearch(String(req.query.q ?? ''), requireScope(req)))),
);

crmRouter.get(
  '/leads',
  validate({ query: s.leadListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as Omit<leads.LeadListFilter, 'assignedToId'> & { assignee?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee === 'none' ? null : q.assignee || undefined;
    const { assignee: _assignee, ...filter } = q;
    void _assignee;
    ok(res, await leads.listLeads({ ...filter, assignedToId }, requireScope(req)));
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

// Parcours (processus v1.3) : aiguillage → attribution / prise en charge →
// qualification → relances → visite (transmission) ; passerelle ; clôture.
crmRouter.post(
  '/leads/:id/dispatch',
  validate({ body: s.dispatchBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.dispatchLead(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/assign',
  validate({ body: s.assignBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.assignLead(param(req, 'id'), req.body.assignedToId, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/circuit',
  validate({ body: s.circuitBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.changeCircuit(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/qualify',
  validate({ body: s.qualifyBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.qualifyLead(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/follow-up',
  validate({ body: s.followUpBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.recordFollowUp(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/visit',
  validate({ body: s.visitBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.confirmVisit(param(req, 'id'), req.body, req.user!.id, requireScope(req)))),
);
crmRouter.post(
  '/leads/:id/lose',
  validate({ body: s.loseBodySchema }),
  asyncHandler(async (req, res) => ok(res, await flow.loseLead(param(req, 'id'), req.body.reason, req.user!.id, requireScope(req)))),
);
crmRouter.post('/leads/:id/reopen', asyncHandler(async (req, res) => ok(res, await flow.reopenLead(param(req, 'id'), req.user!.id, requireScope(req)))));

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
// Les modèles fixent libellés et prix des services : Direction seulement (25/10/2026).
const manageTemplates = (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!requireScope(req).direction) throw ApiError.forbidden('Les modèles de devis sont gérés par la Direction.');
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
// La validation d'une demande de devis revient à un responsable qui ne suit
// pas forcément le lead : contrôle de portée en lecture, droits vérifiés par le service.
quotesRouter.post('/:id/approve', asyncHandler(async (req, res) => ok(res, await quotes.approveQuote(param(req, 'id'), req.user!.id, requireScope(req)))));
quotesRouter.post(
  '/:id/return',
  validate({ body: s.quoteReturnSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.returnForChanges(param(req, 'id'), req.body.comment, req.user!.id, requireScope(req)))),
);
quotesRouter.use(
  '/:id',
  guard(async (id) => (await prisma.quote.findUnique({ where: { id }, select: { leadId: true } }))?.leadId, ['templates']),
);
quotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const quote = await quotes.getQuote(param(req, 'id'));
  ok(res, { ...quote, approval: quote.status === 'DRAFT' || quote.status === 'PENDING_APPROVAL' ? await quotes.checkApproval(quote) : null });
}));
quotesRouter.patch(
  '/:id',
  validate({ body: s.quotePatchSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.updateQuote(param(req, 'id'), req.body, requireScope(req)))),
);
quotesRouter.post('/:id/submit', asyncHandler(async (req, res) => ok(res, await quotes.submitForApproval(param(req, 'id'), req.user!.id))));
quotesRouter.post('/:id/send', asyncHandler(async (req, res) => ok(res, await quotes.sendQuote(param(req, 'id'), req.user!.id))));
// Confirmation reçue par e-mail (ou refus), consignée par l'intervenant.
quotesRouter.post('/:id/accept', asyncHandler(async (req, res) => ok(res, await quotes.decideQuote(param(req, 'id'), 'ACCEPTED', req.user!.id, 'EMAIL'))));
quotesRouter.post('/:id/reject', asyncHandler(async (req, res) => ok(res, await quotes.decideQuote(param(req, 'id'), 'REJECTED', req.user!.id, 'EMAIL'))));
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
    // Une facture se rattache à un lead visible du compte (pas de facture « libre » hors Direction).
    const scope = requireScope(req);
    if (!scope.allLeads) {
      const leadId =
        req.body.leadId ?? (req.body.quoteId ? (await prisma.quote.findUnique({ where: { id: req.body.quoteId }, select: { leadId: true } }))?.leadId : null);
      if (!leadId) throw ApiError.forbidden('Rattachez cette facture à l’un de vos leads.');
      await assertLeadAccess(scope, leadId);
    }
    ok(res, await invoices.createInvoice(req.body, req.user!.id, scope), 201);
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
  asyncHandler(async (req, res) => ok(res, await invoices.updateInvoice(param(req, 'id'), req.body, requireScope(req)))),
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
invoicesRouter.post(
  '/:id/refund',
  validate({ body: s.invoiceCancelSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.refundInvoice(param(req, 'id'), req.body.reason, req.user!.id))),
);
invoicesRouter.get('/:id/pdf', asyncHandler(async (req, res) => sendPdf(res, await invoices.invoicePdf(param(req, 'id')))));

// ============================ Services clients (livraison) ============================
export const serviceOrdersRouter = Router();
serviceOrdersRouter.use(attachScope);

serviceOrdersRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
// Bureaux privatifs et leur occupant, pour l'attribution sur un service.
serviceOrdersRouter.get('/offices', asyncHandler(async (_req, res) => ok(res, await fulfilment.listOffices())));
serviceOrdersRouter.get(
  '/',
  validate({ query: s.orderListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as { status?: never; pole?: never; userId?: string; expiring?: string; assignee?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee || undefined;
    ok(res, await fulfilment.listOrders({ status: q.status, pole: q.pole, userId: q.userId, expiring: Boolean(q.expiring), assignedToId }, requireScope(req)));
  }),
);
// Service hors portée : ni assigné au compte, ni dans son pôle / ses dossiers.
serviceOrdersRouter.use('/:id', async (req, _res, next) => {
  try {
    if (req.params.id === 'staff') return next();
    const scope = requireScope(req);
    const visible = await prisma.serviceOrder.findFirst({ where: { id: String(req.params.id), ...fulfilment.orderScopeWhere(scope) }, select: { id: true } });
    if (!visible) return next(ApiError.notFound('Introuvable'));
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
serviceOrdersRouter.post('/:id/start', asyncHandler(async (req, res) => ok(res, await fulfilment.startOrder(param(req, 'id'), req.user!.id))));
serviceOrdersRouter.post('/:id/ready', asyncHandler(async (req, res) => ok(res, await fulfilment.markOrderReady(param(req, 'id'), req.user!.id))));
// Validation pour le compte du membre (le référent confirme avec lui).
serviceOrdersRouter.post('/:id/validate', asyncHandler(async (req, res) => ok(res, await fulfilment.validateOrder(param(req, 'id'), { id: req.user!.id, isMember: false }))));
serviceOrdersRouter.post(
  '/:id/adjustment',
  validate({ body: s.orderNoteSchema }),
  asyncHandler(async (req, res) => ok(res, await fulfilment.requestAdjustment(param(req, 'id'), req.body.note, { id: req.user!.id, isMember: false }))),
);
serviceOrdersRouter.post(
  '/:id/cancel',
  validate({ body: s.orderCancelSchema }),
  asyncHandler(async (req, res) => ok(res, await fulfilment.cancelOrder(param(req, 'id'), req.body.reason, req.user!.id))),
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

// ============================ Commissions ============================
export const commissionsRouter = Router();
commissionsRouter.use(attachScope);
const directionOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (!requireScope(req).direction) return next(ApiError.forbidden('Le barème des commissions est géré par la Direction.'));
  next();
};

commissionsRouter.get('/rules', asyncHandler(async (_req, res) => ok(res, await commissions.listRules())));
commissionsRouter.post('/rules', directionOnly, validate({ body: s.commissionRuleSchema }), asyncHandler(async (req, res) => ok(res, await commissions.createRule(req.body), 201)));
commissionsRouter.patch('/rules/:id', directionOnly, validate({ body: s.commissionRulePatchSchema }), asyncHandler(async (req, res) => ok(res, await commissions.updateRule(param(req, 'id'), req.body))));
commissionsRouter.delete(
  '/rules/:id',
  directionOnly,
  asyncHandler(async (req, res) => {
    await commissions.deleteRule(param(req, 'id'));
    res.status(204).send();
  }),
);
commissionsRouter.get(
  '/statement',
  validate({ query: s.statementQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await commissions.monthlyStatement((req.validatedQuery as { month: string }).month, requireScope(req)))),
);
commissionsRouter.get(
  '/',
  validate({ query: s.commissionListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await commissions.listCommissions(req.validatedQuery as never, requireScope(req)))),
);
commissionsRouter.post('/check', validate({ body: s.commissionIdsSchema }), asyncHandler(async (req, res) => ok(res, { count: await commissions.checkCommissions(req.body.ids, req.user!.id, requireScope(req)) })));
commissionsRouter.post('/validate', validate({ body: s.commissionIdsSchema }), asyncHandler(async (req, res) => ok(res, { count: await commissions.validateCommissions(req.body.ids, req.user!.id, requireScope(req)) })));
commissionsRouter.post('/pay', validate({ body: s.commissionIdsSchema }), asyncHandler(async (req, res) => ok(res, { count: await commissions.payCommissions(req.body.ids, requireScope(req)) })));
