import { Router, type Response } from 'express';
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
import * as s from './crm.schema';

// Routes montées sous /api/admin (cf. admin.routes.ts) : l'accès est déjà
// filtré par adminPermission — `crm`, `quotes`, `invoices` et `fulfilment` sont
// les blocs de permissions de l'équipe commerciale.

function sendPdf(res: Response, file: { number: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.number}.pdf"`);
  res.send(file.buffer);
}

// ============================ CRM ============================
export const crmRouter = Router();

crmRouter.get('/dashboard', asyncHandler(async (_req, res) => ok(res, await leads.getDashboard())));
crmRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
crmRouter.get(
  '/search',
  asyncHandler(async (req, res) => ok(res, await leads.globalSearch(String(req.query.q ?? '')))),
);

crmRouter.get(
  '/leads',
  validate({ query: s.leadListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as { stage?: never; source?: never; assignee?: string; search?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee === 'none' ? null : q.assignee || undefined;
    ok(res, await leads.listLeads({ stage: q.stage, source: q.source, search: q.search, assignedToId }));
  }),
);
crmRouter.post(
  '/leads',
  validate({ body: s.leadBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.createLead(req.body, req.user!.id), 201)),
);
crmRouter.get('/leads/:id', asyncHandler(async (req, res) => ok(res, await leads.getLead(param(req, 'id')))));
crmRouter.patch(
  '/leads/:id',
  validate({ body: s.leadPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.updateLead(param(req, 'id'), req.body, req.user!.id))),
);
crmRouter.post(
  '/leads/:id/stage',
  validate({ body: s.stageBodySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await leads.changeStage(param(req, 'id'), req.body.stage, req.user!.id, req.body.lostReason)),
  ),
);
crmRouter.post(
  '/leads/:id/activities',
  validate({ body: s.activityBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.addActivity(param(req, 'id'), req.body, req.user!.id), 201)),
);
crmRouter.post(
  '/leads/:id/appointments',
  validate({ body: s.appointmentBodySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.createAppointment(param(req, 'id'), req.body, req.user!.id), 201)),
);

crmRouter.get(
  '/activities',
  validate({ query: s.activityListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.listActivities(req.validatedQuery as never))),
);

crmRouter.get(
  '/appointments',
  validate({ query: s.appointmentListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await leads.listAppointments(req.validatedQuery as never))),
);
crmRouter.patch(
  '/appointments/:id',
  validate({ body: s.appointmentPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.updateAppointment(param(req, 'id'), req.body, req.user!.id))),
);
crmRouter.delete(
  '/appointments/:id',
  asyncHandler(async (req, res) => {
    await leads.deleteAppointment(param(req, 'id'));
    res.status(204).send();
  }),
);

crmRouter.get('/automations/rules', (_req, res) => ok(res, AUTOMATION_RULES));
crmRouter.post('/automations/run', asyncHandler(async (_req, res) => ok(res, await runAutomations())));

// ============================ Devis ============================
export const quotesRouter = Router();

// Les modèles d'abord : « /templates » ne doit pas être lu comme un :id.
quotesRouter.get('/templates', asyncHandler(async (_req, res) => ok(res, await quotes.listTemplates())));
quotesRouter.post(
  '/templates',
  validate({ body: s.templateBodySchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.createTemplate(req.body), 201)),
);
quotesRouter.patch(
  '/templates/:id',
  validate({ body: s.templatePatchSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.updateTemplate(param(req, 'id'), req.body))),
);
quotesRouter.delete(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    await quotes.deleteTemplate(param(req, 'id'));
    res.status(204).send();
  }),
);

quotesRouter.get(
  '/',
  validate({ query: s.quoteListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.listQuotes(req.validatedQuery as never))),
);
quotesRouter.post(
  '/',
  validate({ body: s.quoteCreateSchema }),
  asyncHandler(async (req, res) => ok(res, await quotes.createQuote(req.body, req.user!.id), 201)),
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

invoicesRouter.get(
  '/',
  validate({ query: s.invoiceListQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.listInvoices(req.validatedQuery as never))),
);
invoicesRouter.post(
  '/',
  validate({ body: s.invoiceCreateSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.createInvoice(req.body, req.user!.id), 201)),
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

serviceOrdersRouter.get('/staff', asyncHandler(async (_req, res) => ok(res, await listStaff())));
serviceOrdersRouter.get(
  '/',
  validate({ query: s.orderListQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as { status?: never; assignee?: string };
    const assignedToId = q.assignee === 'me' ? req.user!.id : q.assignee || undefined;
    ok(res, await fulfilment.listOrders({ status: q.status, assignedToId }));
  }),
);
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
