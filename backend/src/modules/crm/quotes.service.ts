import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { renderDocumentPdf, type PdfDocumentInput } from './documentPdf';
import { advanceStageTo, logActivity } from './leads.service';
import { DEFAULT_VAT_RATE, computeTotals, formatAmount } from './money';
import { nextNumber } from './numbering';
import { STAFF_SELECT } from './staff';

// Devis : brouillon → envoyé (PDF par email) → accepté / refusé / expiré.

export interface DocLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  serviceId?: string | null;
  planId?: string | null;
  spaceId?: string | null;
  tierLabel?: string | null;
}

const QUOTE_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true, email: true, phone: true, assignedToId: true } },
  createdBy: { select: STAFF_SELECT },
  invoices: { select: { id: true, number: true, status: true } },
} satisfies Prisma.QuoteInclude;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

function lineData(lines: DocLineInput[]) {
  return lines.map((line, position) => ({
    position,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    serviceId: line.serviceId ?? null,
    planId: line.planId ?? null,
    spaceId: line.spaceId ?? null,
    tierLabel: line.tierLabel ?? null,
  }));
}

export async function listQuotes(filter: { status?: string; leadId?: string; search?: string }) {
  const search = filter.search?.trim();
  return prisma.quote.findMany({
    where: {
      status: filter.status as never,
      leadId: filter.leadId,
      ...(search ? { OR: [{ number: { contains: search } }, { lead: { contactName: { contains: search } } }, { lead: { companyName: { contains: search } } }, { lead: { title: { contains: search } } }] } : {}),
    },
    include: { lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
}

export async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: QUOTE_INCLUDE });
  if (!quote) throw ApiError.notFound('Devis introuvable');
  return quote;
}

interface TemplateLine {
  description: string;
  quantity?: number;
  unitPrice: number;
  serviceSlug?: string;
  tierLabel?: string;
}

export async function createQuote(input: { leadId: string; templateId?: string }, actorId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { serviceRequest: { include: { items: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!lead) throw ApiError.notFound('Lead introuvable');

  let lines: DocLineInput[] = [];
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
  } else if (lead.serviceRequest?.items.length) {
    // Devis pré-rempli avec le panier du client (prix figés à l'envoi ; les
    // lignes « sur devis » démarrent à 0 et sont chiffrées par le commercial).
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
  await prisma.quote.update({ where: { id }, data: { status: 'DRAFT', acceptedAt: null, rejectedAt: null } });
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
    stamp: quote.status === 'ACCEPTED' ? 'ACCEPTÉ' : quote.status === 'EXPIRED' ? 'EXPIRÉ' : quote.status === 'REJECTED' ? 'REFUSÉ' : quote.status === 'DRAFT' ? 'BROUILLON' : null,
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
    '<p>Nous restons à votre disposition pour toute question.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ].join('');
}

export async function sendQuote(id: string, actorId: string) {
  const quote = await getQuote(id);
  if (quote.status === 'ACCEPTED' || quote.status === 'REJECTED') throw ApiError.conflict('Ce devis est déjà clos.');
  if (quote.lines.length === 0) throw ApiError.badRequest('Ajoutez au moins une ligne avant d’envoyer le devis.');
  if (quote.validUntil && quote.validUntil < new Date()) {
    throw ApiError.badRequest('La date de validité du devis est dépassée : mettez-la à jour avant l’envoi.');
  }
  if (quote.lines.some((l) => Number(l.unitPrice) <= 0)) {
    throw ApiError.badRequest('Certaines lignes n’ont pas de prix : chiffrez-les avant l’envoi.');
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
  return { quote: await getQuote(id), emailed, emailError };
}

export async function decideQuote(id: string, decision: 'ACCEPTED' | 'REJECTED', actorId: string) {
  const quote = await getQuote(id);
  if (quote.status !== 'SENT') throw ApiError.conflict('Seul un devis envoyé peut être accepté ou refusé.');
  await prisma.quote.update({
    where: { id },
    data: decision === 'ACCEPTED' ? { status: 'ACCEPTED', acceptedAt: new Date() } : { status: 'REJECTED', rejectedAt: new Date() },
  });
  await logActivity(quote.leadId, {
    content: decision === 'ACCEPTED' ? `Devis ${quote.number} accepté par le client.` : `Devis ${quote.number} refusé par le client.`,
    authorId: actorId,
  });
  if (decision === 'ACCEPTED') await advanceStageTo(quote.leadId, 'WON', actorId);
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
