import type { InvoicePaymentMethod, Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { renderDocumentPdf, type PdfDocumentInput } from './documentPdf';
import { launchServicesForInvoice } from './fulfilment.service';
import { advanceStageTo, logActivity } from './leads.service';
import { DEFAULT_VAT_RATE, computeTotals, formatAmount, round2 } from './money';
import { nextNumber } from './numbering';
import { STAFF_SELECT } from './staff';
import type { DocLineInput } from './quotes.service';

// Facture : brouillon → émise (numéro attribué, PDF par email) → payée
// (déclenche le lancement des services) ou annulée.

const INVOICE_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  lead: { select: { id: true, reference: true, title: true, assignedToId: true, userId: true } },
  quote: { select: { id: true, number: true } },
  createdBy: { select: STAFF_SELECT },
  serviceOrders: { select: { id: true, title: true, status: true } },
} satisfies Prisma.InvoiceInclude;

const DEFAULT_PAYMENT_DELAY_DAYS = 30;

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

export async function listInvoices(filter: { status?: string; leadId?: string; search?: string }) {
  const search = filter.search?.trim();
  return prisma.invoice.findMany({
    where: {
      status: filter.status as never,
      leadId: filter.leadId,
      ...(search ? { OR: [{ number: { contains: search } }, { customerName: { contains: search } }, { customerCompany: { contains: search } }] } : {}),
    },
    include: { lead: { select: { id: true, reference: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!invoice) throw ApiError.notFound('Facture introuvable');
  return invoice;
}

export interface CustomerInput {
  customerName?: string;
  customerCompany?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerNif?: string | null;
  customerRc?: string | null;
  customerAi?: string | null;
}

export async function createInvoice(
  input: { leadId?: string; quoteId?: string; lines?: DocLineInput[] } & CustomerInput,
  actorId: string,
) {
  let leadId = input.leadId;
  let quoteId = input.quoteId;
  let lines = input.lines ?? [];
  let vatRate = DEFAULT_VAT_RATE;

  if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { lines: { orderBy: { position: 'asc' } }, invoices: { select: { status: true } } } });
    if (!quote) throw ApiError.notFound('Devis introuvable');
    if (quote.invoices.some((inv) => inv.status !== 'CANCELLED')) {
      throw ApiError.conflict('Une facture existe déjà pour ce devis.');
    }
    leadId = quote.leadId;
    vatRate = Number(quote.vatRate);
    lines = quote.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      serviceId: l.serviceId,
      planId: l.planId,
      spaceId: l.spaceId,
      tierLabel: l.tierLabel,
    }));
  }

  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  if (leadId && !lead) throw ApiError.notFound('Lead introuvable');

  const customerName = input.customerName ?? lead?.contactName;
  if (!customerName) throw ApiError.badRequest('Le nom du client est requis.');

  const totals = computeTotals(lines, vatRate);
  const invoice = await prisma.invoice.create({
    data: {
      leadId,
      quoteId,
      customerName,
      customerCompany: input.customerCompany ?? lead?.companyName,
      customerEmail: input.customerEmail ?? lead?.email,
      customerPhone: input.customerPhone ?? lead?.phone,
      customerAddress: input.customerAddress,
      customerNif: input.customerNif,
      customerRc: input.customerRc,
      customerAi: input.customerAi,
      vatRate,
      ...totals,
      createdById: actorId,
      lines: { create: lineData(lines) },
    },
    include: INVOICE_INCLUDE,
  });
  if (leadId) await logActivity(leadId, { content: 'Facture en brouillon créée.', authorId: actorId });
  return invoice;
}

export async function updateInvoice(
  id: string,
  patch: CustomerInput & { vatRate?: number; dueDate?: Date | null; notes?: string | null; lines?: DocLineInput[] },
) {
  const existing = await getInvoice(id);
  if (existing.status !== 'DRAFT') throw ApiError.conflict('Une facture émise ne peut plus être modifiée.');

  const { lines, ...rest } = patch;
  const vatRate = patch.vatRate ?? Number(existing.vatRate);
  const currentLines = lines ?? existing.lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));
  const totals = computeTotals(currentLines, vatRate);

  await prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.createMany({ data: lineData(lines).map((l) => ({ ...l, invoiceId: id })) });
    }
    await tx.invoice.update({ where: { id }, data: { ...rest, vatRate, ...totals } });
  });
  return getInvoice(id);
}

export async function deleteDraftInvoice(id: string) {
  const invoice = await getInvoice(id);
  if (invoice.status !== 'DRAFT') throw ApiError.conflict('Seul un brouillon peut être supprimé (une facture émise s’annule).');
  await prisma.invoice.delete({ where: { id } });
}

const PAYMENT_LABEL: Record<InvoicePaymentMethod, string> = {
  BANK_TRANSFER: 'virement bancaire',
  CASH: 'espèces',
  CHEQUE: 'chèque',
  CARD: 'carte bancaire',
};

export async function invoicePdf(id: string) {
  const invoice = await getInvoice(id);
  const input: PdfDocumentInput = {
    kind: 'INVOICE',
    number: invoice.number ?? 'BROUILLON',
    date: invoice.issueDate ?? invoice.createdAt,
    dueDate: invoice.dueDate,
    customer: {
      name: invoice.customerName,
      company: invoice.customerCompany,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
      nif: invoice.customerNif,
      rc: invoice.customerRc,
      ai: invoice.customerAi,
    },
    lines: invoice.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    vatRate: Number(invoice.vatRate),
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    notes: invoice.notes,
    stamp: invoice.status === 'PAID' ? 'PAYÉE' : invoice.status === 'CANCELLED' ? 'ANNULÉE' : invoice.status === 'DRAFT' ? 'BROUILLON' : null,
    paymentInfo:
      invoice.status === 'PAID' && invoice.paidAt && invoice.paymentMethod
        ? `Payée le ${invoice.paidAt.toLocaleDateString('fr-FR')} par ${PAYMENT_LABEL[invoice.paymentMethod]}${invoice.paymentRef ? ` (réf. ${invoice.paymentRef})` : ''}.`
        : null,
  };
  return { number: input.number, buffer: await renderDocumentPdf(input) };
}

function invoiceEmailHtml(invoice: Awaited<ReturnType<typeof getInvoice>>, intro: string) {
  return [
    `<p>Bonjour ${escapeHtml(invoice.customerName)},</p>`,
    `<p>${intro}</p>`,
    `<p><strong>Facture ${invoice.number} — ${formatAmount(Number(invoice.total))} TTC</strong>${invoice.dueDate ? `<br>Échéance : ${invoice.dueDate.toLocaleDateString('fr-FR')}` : ''}</p>`,
    '<p>Le document est joint à ce message au format PDF.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ].join('');
}

async function emailInvoice(id: string, subject: string, intro: string) {
  const invoice = await getInvoice(id);
  if (!invoice.customerEmail) return { emailed: false as const, emailError: 'Aucune adresse email sur la facture.' };
  try {
    const { buffer } = await invoicePdf(id);
    await sendEmail({
      to: invoice.customerEmail,
      subject: `${subject} ${invoice.number} — IN NETWORK`,
      html: invoiceEmailHtml(invoice, intro),
      attachments: [{ filename: `${invoice.number}.pdf`, content: buffer }],
    });
    return { emailed: true as const };
  } catch (err) {
    console.error('[invoices] échec envoi email', err);
    return { emailed: false as const, emailError: err instanceof Error ? err.message : 'Envoi impossible' };
  }
}

export async function issueInvoice(id: string, input: { dueDate?: Date; send?: boolean }, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status !== 'DRAFT') throw ApiError.conflict('Cette facture est déjà émise.');
  if (invoice.lines.length === 0) throw ApiError.badRequest('Ajoutez au moins une ligne avant d’émettre la facture.');
  if (Number(invoice.total) <= 0) throw ApiError.badRequest('Le montant de la facture doit être supérieur à zéro.');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        number: await nextNumber('FA', tx),
        status: 'SENT',
        issueDate: now,
        dueDate: input.dueDate ?? invoice.dueDate ?? new Date(now.getTime() + DEFAULT_PAYMENT_DELAY_DAYS * 24 * 3600 * 1000),
      },
    });
  });

  const issued = await getInvoice(id);
  const mail = input.send ? await emailInvoice(id, 'Votre facture', 'Veuillez trouver ci-dessous votre facture.') : null;
  if (issued.leadId) {
    await logActivity(issued.leadId, {
      content: `Facture ${issued.number} émise${mail?.emailed ? ` et envoyée à ${issued.customerEmail}` : ''}${mail && !mail.emailed ? ` (email non envoyé : ${mail.emailError})` : ''}.`,
      authorId: actorId,
    });
    await advanceStageTo(issued.leadId, 'QUOTE_SENT', actorId);
  }
  return { invoice: issued, emailed: mail?.emailed ?? false, emailError: mail && !mail.emailed ? mail.emailError : undefined };
}

export async function sendInvoice(id: string, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'DRAFT') throw ApiError.conflict('Émettez la facture avant de l’envoyer.');
  const mail = await emailInvoice(id, invoice.status === 'PAID' ? 'Votre facture acquittée' : 'Votre facture', invoice.status === 'PAID' ? 'Veuillez trouver ci-dessous votre facture acquittée.' : 'Veuillez trouver ci-dessous votre facture.');
  if (invoice.leadId) {
    await logActivity(invoice.leadId, {
      content: mail.emailed ? `Facture ${invoice.number} envoyée à ${invoice.customerEmail}.` : `Envoi de la facture ${invoice.number} impossible : ${mail.emailError}`,
      authorId: actorId,
    });
  }
  return mail;
}

export async function recordPayment(
  id: string,
  input: { method: InvoicePaymentMethod; paidAt?: Date; reference?: string | null },
  actorId: string,
) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'PAID') throw ApiError.conflict('Cette facture est déjà payée.');
  if (invoice.status !== 'SENT') throw ApiError.conflict('Émettez la facture avant d’enregistrer son paiement.');

  await prisma.invoice.update({
    where: { id },
    data: { status: 'PAID', paidAt: input.paidAt ?? new Date(), paymentMethod: input.method, paymentRef: input.reference ?? null },
  });
  if (invoice.leadId) {
    await logActivity(invoice.leadId, {
      content: `Paiement de ${formatAmount(round2(Number(invoice.total)))} enregistré pour la facture ${invoice.number} (${PAYMENT_LABEL[input.method]}).`,
      authorId: actorId,
    });
    await advanceStageTo(invoice.leadId, 'WON', actorId);
  }

  // Lancement du service : commandes + checklists + abonnement du membre.
  const orders = await launchServicesForInvoice(id, actorId);
  emailInvoice(id, 'Votre facture acquittée', 'Nous avons bien reçu votre paiement, merci. Voici votre facture acquittée.').catch(() => undefined);
  return { invoice: await getInvoice(id), orders };
}

export async function cancelInvoice(id: string, reason: string, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'PAID') throw ApiError.conflict('Une facture payée ne peut pas être annulée.');
  if (invoice.status === 'DRAFT') throw ApiError.conflict('Supprimez plutôt le brouillon.');
  if (invoice.status === 'CANCELLED') return invoice;
  await prisma.invoice.update({
    where: { id },
    data: { status: 'CANCELLED', notes: [invoice.notes, `Annulée : ${reason}`].filter(Boolean).join('\n') },
  });
  if (invoice.leadId) await logActivity(invoice.leadId, { content: `Facture ${invoice.number} annulée (${reason}).`, authorId: actorId });
  return getInvoice(id);
}
