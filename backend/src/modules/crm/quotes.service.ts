import type { Prisma, QuoteConfirmation } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { getSettings } from '../settings/settings.service';
import { renderDocumentPdf, type PdfDocumentInput } from './documentPdf';
import { advanceStageTo, logActivity, scheduleTask } from './leads.service';
import { DEFAULT_VAT_RATE, computeTotals, formatAmount } from './money';
import { nextNumber } from './numbering';
import { assertLeadAccess, leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, listStaffByRole, listStaffWith, notifyUsers } from './staff';

// Devis (phase 3 du processus v1.3) : brouillon → envoyé (PDF par e-mail,
// suivi par l'intervenant) → confirmé / refusé / expiré.
// « L'offre a-t-elle un tarif défini ? » Oui : le devis part directement.
// Non (création avec mandat, bureau privatif, B2B… ou prix ajusté) : c'est une
// demande de devis, validée par le responsable commercial ou la Direction avant
// l'envoi (statut PENDING_APPROVAL).
// Confirmé : l'Office Manager appelle le client pour organiser le paiement.

export interface DocLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  serviceId?: string | null;
  planId?: string | null;
  spaceId?: string | null;
  tierLabel?: string | null;
  renewsOrderId?: string | null;
}

const QUOTE_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true, email: true, phone: true, assignedToId: true, circuit: true, channel: true, userId: true } },
  createdBy: { select: STAFF_SELECT },
  approvedBy: { select: STAFF_SELECT },
  invoices: { select: { id: true, number: true, proformaNumber: true, status: true } },
} satisfies Prisma.QuoteInclude;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export function lineData(lines: DocLineInput[]) {
  return lines.map((line, position) => ({
    position,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    serviceId: line.serviceId ?? null,
    planId: line.planId ?? null,
    spaceId: line.spaceId ?? null,
    tierLabel: line.tierLabel ?? null,
    renewsOrderId: line.renewsOrderId ?? null,
  }));
}

export async function listQuotes(filter: { status?: string; leadId?: string; search?: string }, scope?: StaffScope) {
  const search = filter.search?.trim();
  const scoped = leadScopeWhere(scope);
  return prisma.quote.findMany({
    where: {
      status: filter.status as never,
      leadId: filter.leadId,
      ...(scoped ? { lead: scoped } : {}),
      ...(search ? { OR: [{ number: { contains: search } }, { lead: { contactName: { contains: search } } }, { lead: { companyName: { contains: search } } }, { lead: { title: { contains: search } } }] } : {}),
    },
    include: { lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true, circuit: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
}

export async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: QUOTE_INCLUDE });
  if (!quote) throw ApiError.notFound('Devis introuvable');
  return quote;
}

// --- Tarif défini ou sur mesure ------------------------------------------------

interface PricingTier {
  label: string;
  price: number;
}
const tiersOf = (value: unknown): PricingTier[] => (Array.isArray(value) ? (value as PricingTier[]) : []);
const samePrice = (a: number, b: number | null | undefined) => b !== null && b !== undefined && Math.abs(a - Number(b)) < 0.005;

export interface ApprovalCheck {
  required: boolean;
  /** Qui valide : le responsable commercial (circuit 1) ou la Direction. */
  approver: 'SALES_MANAGER' | 'DIRECTION' | null;
  reasons: string[];
}

/**
 * Un devis est « à tarif défini » si chaque ligne reprend un prix du catalogue
 * (service, palier, formule ou tarif de salle). Sinon — service sur devis,
 * ligne libre, prix ajusté — c'est une demande de devis à faire valider. Un
 * montant au-delà du seuil fixé dans les paramètres passe par la Direction.
 */
export async function checkApproval(quote: { total: unknown; lines: { description: string; unitPrice: unknown; serviceId: string | null; planId: string | null; spaceId: string | null; tierLabel: string | null }[]; lead: { circuit: string | null } }): Promise<ApprovalCheck> {
  const ids = (key: 'serviceId' | 'planId' | 'spaceId') => quote.lines.map((l) => l[key]).filter((id): id is string => Boolean(id));
  const [services, plans, spaces, settings] = await Promise.all([
    prisma.serviceCatalogItem.findMany({ where: { id: { in: ids('serviceId') } }, select: { id: true, title: true, priceFrom: true, pricingTiers: true } }),
    prisma.membershipPlan.findMany({ where: { id: { in: ids('planId') } }, select: { id: true, price: true } }),
    prisma.spaceResource.findMany({ where: { id: { in: ids('spaceId') } } }),
    getSettings(),
  ]);

  const reasons: string[] = [];
  for (const line of quote.lines) {
    const price = Number(line.unitPrice);
    if (line.serviceId) {
      const service = services.find((s) => s.id === line.serviceId);
      const tiers = tiersOf(service?.pricingTiers);
      // Un service à paliers n'a de tarif défini qu'une fois le palier choisi
      // (priceFrom n'est alors que le « à partir de »).
      const catalogPrice = line.tierLabel ? tiers.find((t) => t.label === line.tierLabel)?.price : tiers.length ? undefined : service?.priceFrom;
      if (!service || (catalogPrice === null || catalogPrice === undefined)) reasons.push(`« ${line.description} » est sur devis`);
      else if (!samePrice(price, Number(catalogPrice))) reasons.push(`prix ajusté sur « ${line.description} »`);
    } else if (line.planId) {
      const plan = plans.find((p) => p.id === line.planId);
      if (!plan || !samePrice(price, Number(plan.price))) reasons.push(`prix ajusté sur « ${line.description} »`);
    } else if (line.spaceId) {
      const space = spaces.find((s) => s.id === line.spaceId);
      const rates = space
        ? [space.monthlyRate, space.hourlyRateMember, space.halfDayRateMember, space.dailyRateMember, space.hourlyRateExternal, space.halfDayRateExternal, space.dailyRateExternal]
        : [];
      if (!rates.some((rate) => rate !== null && samePrice(price, Number(rate)))) reasons.push(`tarif de salle ajusté sur « ${line.description} »`);
    } else {
      reasons.push(`« ${line.description} » n’est pas au catalogue`);
    }
  }

  const overThreshold = settings.quoteDirectionThreshold !== null && Number(quote.total) > settings.quoteDirectionThreshold;
  if (overThreshold) reasons.push(`montant supérieur à ${formatAmount(settings.quoteDirectionThreshold!)} TTC`);
  if (reasons.length === 0) return { required: false, approver: null, reasons };
  const direction = overThreshold || (quote.lead.circuit !== 'SALES_TEAM' && settings.directionApprovesOfficeManagerQuotes);
  return { required: true, approver: direction ? 'DIRECTION' : 'SALES_MANAGER', reasons };
}

/** Le compte peut-il valider ce devis ? */
function canApprove(scope: StaffScope | undefined, approver: ApprovalCheck['approver']) {
  if (!scope || scope.direction) return true;
  return approver === 'SALES_MANAGER' && scope.salesManager;
}

// --- Création, modification ------------------------------------------------------

interface TemplateLine {
  description: string;
  quantity?: number;
  unitPrice: number;
  serviceSlug?: string;
  tierLabel?: string;
}

/**
 * Nouveau devis sur un lead : à partir d'un modèle, de lignes fournies
 * (renouvellement), ou du panier envoyé par le client (prix figés à l'envoi ;
 * les lignes « sur devis » démarrent à 0 et sont chiffrées par l'intervenant).
 */
export async function createQuote(input: { leadId: string; templateId?: string; lines?: DocLineInput[] }, actorId: string | null, scope?: StaffScope) {
  await assertLeadAccess(scope, input.leadId);
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { serviceRequest: { include: { items: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  if (lead.stage === 'PAID' || lead.stage === 'LOST') throw ApiError.conflict('Ce lead est clos.');

  let lines: DocLineInput[] = input.lines ?? [];
  let validityDays = 15;
  let notes: string | undefined;

  if (input.templateId) {
    const template = await prisma.quoteTemplate.findUnique({ where: { id: input.templateId } });
    if (!template) throw ApiError.notFound('Modèle de devis introuvable');
    validityDays = template.validityDays;
    notes = template.notes ?? undefined;
    const templateLines = (Array.isArray(template.lines) ? template.lines : []) as unknown as TemplateLine[];
    const slugs = templateLines.map((l) => l.serviceSlug).filter((s): s is string => Boolean(s));
    const services = slugs.length ? await prisma.serviceCatalogItem.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } }) : [];
    lines = templateLines.map((l) => ({
      description: l.description,
      quantity: l.quantity ?? 1,
      unitPrice: l.unitPrice,
      serviceId: services.find((s) => s.slug === l.serviceSlug)?.id ?? null,
      tierLabel: l.tierLabel ?? null,
    }));
  } else if (!input.lines && lead.serviceRequest?.items.length) {
    lines = lead.serviceRequest.items.map((item) => ({
      description: item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title,
      quantity: 1,
      unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
      serviceId: item.serviceId,
      planId: item.planId,
      spaceId: item.spaceId,
      tierLabel: item.tierLabel,
    }));
  }

  const totals = computeTotals(lines, DEFAULT_VAT_RATE);
  const validUntil = new Date(Date.now() + validityDays * 24 * 3600 * 1000);
  const quote = await prisma.quote.create({
    data: {
      number: await nextNumber('DV'),
      leadId: lead.id,
      validUntil,
      notes,
      vatRate: DEFAULT_VAT_RATE,
      subtotal: totals.subtotal,
      total: totals.total,
      createdById: actorId,
      lines: { create: lineData(lines) },
    },
    include: QUOTE_INCLUDE,
  });
  await logActivity(lead.id, { content: `Devis ${quote.number} créé.`, authorId: actorId });
  return quote;
}

export async function updateQuote(
  id: string,
  patch: { validUntil?: Date | null; notes?: string | null; vatRate?: number; lines?: DocLineInput[] },
) {
  const existing = await getQuote(id);
  if (existing.status !== 'DRAFT') throw ApiError.conflict('Seul un devis en brouillon peut être modifié — repassez-le en brouillon d’abord.');

  const vatRate = patch.vatRate ?? Number(existing.vatRate);
  const lines = patch.lines ?? existing.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));
  const totals = computeTotals(lines, vatRate);

  await prisma.$transaction(async (tx) => {
    if (patch.lines) {
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });
      await tx.quoteLine.createMany({ data: lineData(patch.lines).map((l) => ({ ...l, quoteId: id })) });
    }
    await tx.quote.update({
      where: { id },
      data: {
        validUntil: patch.validUntil,
        notes: patch.notes,
        vatRate,
        subtotal: totals.subtotal,
        total: totals.total,
        // Une validation porte sur un contenu précis : le modifier l'annule.
        ...(patch.lines || patch.vatRate !== undefined ? { approvedAt: null, approvedById: null } : {}),
      },
    });
  });
  return getQuote(id);
}

export async function reopenQuote(id: string, actorId: string) {
  const quote = await getQuote(id);
  if (quote.status === 'DRAFT') return quote;
  if (quote.invoices.some((inv) => inv.status !== 'CANCELLED')) {
    throw ApiError.conflict('Une facture existe déjà pour ce devis : il ne peut plus être modifié.');
  }
  await prisma.quote.update({ where: { id }, data: { status: 'DRAFT', acceptedAt: null, rejectedAt: null, confirmedVia: null } });
  await logActivity(quote.leadId, { content: `Devis ${quote.number} repassé en brouillon.`, authorId: actorId });
  return getQuote(id);
}

export async function quotePdf(id: string) {
  const quote = await getQuote(id);
  const input: PdfDocumentInput = {
    kind: 'QUOTE',
    number: quote.number,
    date: quote.createdAt,
    dueDate: quote.validUntil,
    customer: { name: quote.lead.contactName, company: quote.lead.companyName, email: quote.lead.email, phone: quote.lead.phone },
    lines: quote.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    vatRate: Number(quote.vatRate),
    subtotal: Number(quote.subtotal),
    vatAmount: Number(quote.total) - Number(quote.subtotal),
    total: Number(quote.total),
    notes: quote.notes,
    stamp:
      quote.status === 'ACCEPTED'
        ? 'ACCEPTÉ'
        : quote.status === 'EXPIRED'
          ? 'EXPIRÉ'
          : quote.status === 'REJECTED'
            ? 'REFUSÉ'
            : quote.status === 'DRAFT' || quote.status === 'PENDING_APPROVAL'
              ? 'BROUILLON'
              : null,
  };
  return { number: quote.number, buffer: await renderDocumentPdf(input) };
}

function quoteEmailHtml(quote: Awaited<ReturnType<typeof getQuote>>) {
  const rows = quote.lines
    .map((l) => `<tr><td style="padding:6px 12px 6px 0">${escapeHtml(l.description)}</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${formatAmount(Number(l.quantity) * Number(l.unitPrice))}</td></tr>`)
    .join('');
  return [
    `<p>Bonjour ${escapeHtml(quote.lead.contactName)},</p>`,
    `<p>Suite à nos échanges, vous trouverez ci-joint notre devis <strong>${quote.number}</strong>.</p>`,
    `<table style="border-collapse:collapse;font-size:14px">${rows}</table>`,
    `<p><strong>Total TTC : ${formatAmount(Number(quote.total))}</strong>${quote.validUntil ? ` — valable jusqu’au ${quote.validUntil.toLocaleDateString('fr-FR')}` : ''}.</p>`,
    quote.lead.userId
      ? '<p>Vous pouvez le confirmer en un clic depuis votre espace IN NETWORK, rubrique « Devis et factures ».</p>'
      : '<p>Pour le confirmer, il vous suffit de répondre à ce message.</p>',
    '<p>Nous restons à votre disposition pour toute question.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ].join('');
}

// --- Validation des devis sur mesure --------------------------------------------------

async function approversFor(approver: ApprovalCheck['approver']) {
  if (approver === 'DIRECTION') {
    const [admins, supers] = await Promise.all([listStaffByRole('ADMIN'), listStaffByRole('SUPER_ADMIN')]);
    return [...admins, ...supers].map((u) => u.id);
  }
  const managers = (await listStaffWith('crm_manage')).filter((u) => u.role !== 'OFFICE_MANAGER');
  return managers.map((u) => u.id);
}

/** Demande de devis : soumise au responsable commercial ou à la Direction. */
export async function submitForApproval(id: string, actorId: string) {
  const quote = await getQuote(id);
  if (quote.status !== 'DRAFT') throw ApiError.conflict('Seul un brouillon se soumet à validation.');
  if (quote.lines.length === 0) throw ApiError.badRequest('Ajoutez au moins une ligne avant de soumettre le devis.');
  if (quote.lines.some((l) => Number(l.unitPrice) <= 0)) throw ApiError.badRequest('Certaines lignes n’ont pas de prix : chiffrez-les d’abord.');
  const check = await checkApproval(quote);
  if (!check.required) throw ApiError.conflict('Ce devis est à tarif défini : il peut être envoyé directement.');

  await prisma.quote.update({ where: { id }, data: { status: 'PENDING_APPROVAL', approvedAt: null, approvedById: null } });
  await logActivity(quote.leadId, {
    content: `Devis ${quote.number} soumis à validation (${check.approver === 'DIRECTION' ? 'Direction' : 'responsable commercial'}) : ${check.reasons.join(', ')}.`,
    authorId: actorId,
  });
  await notifyUsers(
    (await approversFor(check.approver)).filter((u) => u !== actorId),
    'quote_approval',
    'Devis à valider',
    `${quote.number} — ${quote.lead.contactName} (${formatAmount(Number(quote.total))} TTC)`,
    `/admin/devis/${quote.id}`,
  );
  return getQuote(id);
}

/** Valide la demande de devis puis l'envoie au client. */
export async function approveQuote(id: string, actorId: string, scope?: StaffScope) {
  const quote = await getQuote(id);
  if (quote.status !== 'PENDING_APPROVAL') throw ApiError.conflict('Ce devis n’attend pas de validation.');
  const check = await checkApproval(quote);
  if (!canApprove(scope, check.approver)) {
    throw ApiError.forbidden(check.approver === 'DIRECTION' ? 'Ce devis est validé par la Direction.' : 'Ce devis est validé par le responsable commercial.');
  }
  await prisma.quote.update({ where: { id }, data: { status: 'DRAFT', approvedAt: new Date(), approvedById: actorId } });
  await logActivity(quote.leadId, { content: `Devis ${quote.number} validé.`, authorId: actorId });
  const result = await sendQuote(id, actorId);
  if (quote.createdById && quote.createdById !== actorId) {
    await notifyUsers([quote.createdById], 'quote_approved', 'Devis validé et envoyé', `${quote.number} — ${quote.lead.contactName}`, `/admin/devis/${quote.id}`);
  }
  return result;
}

/** Renvoie la demande de devis à son auteur, avec le motif. */
export async function returnForChanges(id: string, comment: string, actorId: string, scope?: StaffScope) {
  const quote = await getQuote(id);
  if (quote.status !== 'PENDING_APPROVAL') throw ApiError.conflict('Ce devis n’attend pas de validation.');
  const check = await checkApproval(quote);
  if (!canApprove(scope, check.approver)) throw ApiError.forbidden('Vous ne validez pas ce devis.');
  await prisma.quote.update({ where: { id }, data: { status: 'DRAFT' } });
  await logActivity(quote.leadId, { content: `Devis ${quote.number} renvoyé pour modification : ${comment.trim()}`, authorId: actorId });
  const recipient = quote.createdById ?? quote.lead.assignedToId;
  if (recipient && recipient !== actorId) {
    await notifyUsers([recipient], 'quote_returned', 'Devis à revoir', `${quote.number} : ${comment.trim()}`, `/admin/devis/${quote.id}`);
  }
  return getQuote(id);
}

// --- Envoi, confirmation ------------------------------------------------------------

export async function sendQuote(id: string, actorId: string | null) {
  const quote = await getQuote(id);
  if (quote.status === 'ACCEPTED' || quote.status === 'REJECTED') throw ApiError.conflict('Ce devis est déjà clos.');
  if (quote.status === 'PENDING_APPROVAL') throw ApiError.conflict('Ce devis attend sa validation.');
  if (quote.lines.length === 0) throw ApiError.badRequest('Ajoutez au moins une ligne avant d’envoyer le devis.');
  if (quote.validUntil && quote.validUntil < new Date()) {
    throw ApiError.badRequest('La date de validité du devis est dépassée : mettez-la à jour avant l’envoi.');
  }
  if (quote.lines.some((l) => Number(l.unitPrice) <= 0)) {
    throw ApiError.badRequest('Certaines lignes n’ont pas de prix : chiffrez-les avant l’envoi.');
  }
  if (!quote.approvedAt) {
    const check = await checkApproval(quote);
    if (check.required) throw ApiError.conflict(`Demande de devis à faire valider avant l’envoi : ${check.reasons.join(', ')}.`);
  }

  const { buffer } = await quotePdf(id);
  let emailed = false;
  let emailError: string | undefined;
  if (quote.lead.email) {
    try {
      await sendEmail({
        to: quote.lead.email,
        subject: `Votre devis ${quote.number} — IN NETWORK`,
        html: quoteEmailHtml(quote),
        attachments: [{ filename: `${quote.number}.pdf`, content: buffer }],
      });
      emailed = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Envoi impossible';
      console.error('[quotes] échec envoi email du devis', err);
    }
  }

  await prisma.quote.update({
    where: { id },
    data: { status: 'SENT', sentAt: quote.sentAt ?? new Date() },
  });
  await advanceStageTo(quote.leadId, 'QUOTE_SENT', actorId);
  await logActivity(quote.leadId, {
    content: emailed
      ? `Devis ${quote.number} envoyé à ${quote.lead.email}.`
      : `Devis ${quote.number} marqué comme envoyé${quote.lead.email ? ` (l’email a échoué : ${emailError})` : ' (aucune adresse email sur le lead — à remettre en main propre)'}.`,
    authorId: actorId,
  });
  if (quote.lead.userId) {
    await notifyUsers([quote.lead.userId], 'quote_received', 'Nouveau devis', `Votre devis ${quote.number} (${formatAmount(Number(quote.total))} TTC) est disponible.`, '/dashboard/documents');
  }
  return { quote: await getQuote(id), emailed, emailError };
}

/**
 * Le client confirme (depuis son espace, ou par e-mail : l'intervenant le
 * consigne) ou refuse. Confirmé : l'Office Manager appelle le client pour
 * organiser le paiement (tâche dans son agenda).
 */
export async function decideQuote(id: string, decision: 'ACCEPTED' | 'REJECTED', actorId: string, via: QuoteConfirmation = 'EMAIL') {
  const quote = await getQuote(id);
  if (quote.status !== 'SENT') throw ApiError.conflict('Seul un devis envoyé peut être confirmé ou refusé.');
  await prisma.quote.update({
    where: { id },
    data: decision === 'ACCEPTED' ? { status: 'ACCEPTED', acceptedAt: new Date(), confirmedVia: via } : { status: 'REJECTED', rejectedAt: new Date() },
  });
  await logActivity(quote.leadId, {
    content:
      decision === 'ACCEPTED'
        ? `Devis ${quote.number} confirmé par le client (${via === 'PLATFORM' ? 'depuis son espace' : 'par e-mail'}).`
        : `Devis ${quote.number} refusé par le client.`,
    authorId: via === 'PLATFORM' ? null : actorId,
  });
  if (decision === 'ACCEPTED') {
    await advanceStageTo(quote.leadId, 'CONFIRMED', via === 'PLATFORM' ? null : actorId);
    const lead = await prisma.lead.findUnique({ where: { id: quote.leadId }, select: { assignedToId: true, reference: true, contactName: true, channel: true } });
    const omId = lead?.assignedToId ?? null;
    await scheduleTask(quote.leadId, {
      startAt: new Date(),
      assigneeId: omId,
      notes: `Appeler ${lead?.contactName ?? 'le client'} pour organiser le paiement du devis ${quote.number} (${formatAmount(Number(quote.total))} TTC) et lui envoyer la facture proforma.`,
    });
    if (omId) {
      await notifyUsers([omId], 'quote_accepted', 'Devis confirmé : paiement à organiser', `${quote.number} — ${lead?.contactName} : appelez le client et envoyez la proforma.`, `/admin/crm/leads/${quote.leadId}`);
    }
  }
  return getQuote(id);
}

// --- Modèles de devis -----------------------------------------------------------

export const listTemplates = () => prisma.quoteTemplate.findMany({ orderBy: { name: 'asc' } });

export interface TemplateInput {
  name: string;
  description?: string | null;
  validityDays?: number;
  notes?: string | null;
  lines: TemplateLine[];
  isActive?: boolean;
}

export const createTemplate = (input: TemplateInput) =>
  prisma.quoteTemplate.create({ data: { ...input, lines: input.lines as unknown as Prisma.InputJsonValue } });

export const updateTemplate = (id: string, input: Partial<TemplateInput>) => {
  const { lines, ...rest } = input;
  return prisma.quoteTemplate.update({
    where: { id },
    data: { ...rest, ...(lines ? { lines: lines as unknown as Prisma.InputJsonValue } : {}) },
  });
};

export const deleteTemplate = (id: string) => prisma.quoteTemplate.delete({ where: { id } });
