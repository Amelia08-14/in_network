import type { InvoicePaymentMethod, Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { activateMember, ensureMemberAccount } from './activation.service';
import { lockLinesToCatalogue } from './catalogueLines';
import { cancelCommissionsForInvoice, createCommissionsForInvoice } from './commissions.service';
import { discountLabel, renderDocumentPdf, type PdfDocumentInput } from './documentPdf';
import { launchServicesForInvoice } from './fulfilment.service';
import { advanceStageTo, logActivity } from './leads.service';
import { DEFAULT_VAT_RATE, computeTotals, formatAmount, round2, type DocDiscount } from './money';
import { nextNumber } from './numbering';
import { leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, notifyUsers } from './staff';
import { lineData, mergeDiscount, storedLines, type DiscountPatch, type DocLineInput } from './quotes.service';
import { DIASPORA_CHANNELS } from './workflow';

// Facturation (phase 3 du processus v1.3, décision du 23/10/2026) :
//   brouillon → facture proforma envoyée (numéro PF-…), que le client règle en
//   espèces ou par virement (virement pour la diaspora), justificatif à
//   l'appui depuis son espace → l'Office Manager enregistre le paiement : la
//   facture définitive reçoit son numéro FA-… et part au client, l'espace
//   membre se déverrouille, les services sont lancés et les commissions
//   calculées. Une facture payée peut être remboursée (commissions reprises).

const INVOICE_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  lead: { select: { id: true, reference: true, title: true, assignedToId: true, userId: true, channel: true } },
  quote: { select: { id: true, number: true } },
  createdBy: { select: STAFF_SELECT },
  serviceOrders: { select: { id: true, title: true, status: true } },
} satisfies Prisma.InvoiceInclude;

const DEFAULT_PAYMENT_DELAY_DAYS = 30;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export async function listInvoices(filter: { status?: string; leadId?: string; search?: string }, scope?: StaffScope) {
  const search = filter.search?.trim();
  const scoped = leadScopeWhere(scope);
  return prisma.invoice.findMany({
    where: {
      status: filter.status as never,
      leadId: filter.leadId,
      ...(scoped ? { lead: scoped } : {}),
      ...(search ? { OR: [{ number: { contains: search } }, { proformaNumber: { contains: search } }, { customerName: { contains: search } }, { customerCompany: { contains: search } }] } : {}),
    },
    include: { lead: { select: { id: true, reference: true, circuit: true } } },
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
  scope?: StaffScope,
) {
  let leadId = input.leadId;
  let quoteId = input.quoteId;
  let lines = input.lines ?? [];
  let vatRate = DEFAULT_VAT_RATE;
  let discount: DocDiscount = { type: null, value: 0 };

  if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { lines: { orderBy: { position: 'asc' } }, invoices: { select: { status: true } } } });
    if (!quote) throw ApiError.notFound('Devis introuvable');
    if (quote.invoices.some((inv) => inv.status !== 'CANCELLED')) {
      throw ApiError.conflict('Une facture existe déjà pour ce devis.');
    }
    if (quote.status !== 'ACCEPTED' && quote.status !== 'SENT') {
      throw ApiError.conflict('La proforma se prépare sur un devis envoyé au client et confirmé par lui.');
    }
    leadId = quote.leadId;
    vatRate = Number(quote.vatRate);
    // Les remises accordées sur le devis passent telles quelles sur la proforma.
    discount = { type: quote.discountType, value: Number(quote.discountValue) };
    lines = quote.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountRate: Number(l.discountRate),
      serviceId: l.serviceId,
      planId: l.planId,
      spaceId: l.spaceId,
      tierLabel: l.tierLabel,
      renewsOrderId: l.renewsOrderId,
    }));
  }

  // Les lignes reprises d'un devis sont déjà conformes au catalogue.
  if (!quoteId) lines = await lockLinesToCatalogue(lines, scope);
  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  if (leadId && !lead) throw ApiError.notFound('Lead introuvable');

  const customerName = input.customerName ?? lead?.contactName;
  if (!customerName) throw ApiError.badRequest('Le nom du client est requis.');

  const totals = computeTotals(lines, vatRate, discount);
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
      discountType: discount.type,
      discountValue: discount.value,
      ...totals,
      createdById: actorId,
      lines: { create: lineData(lines) },
    },
    include: INVOICE_INCLUDE,
  });
  if (leadId) await logActivity(leadId, { content: 'Facture proforma en brouillon créée.', authorId: actorId });
  return invoice;
}

export async function updateInvoice(
  id: string,
  patch: CustomerInput & { vatRate?: number; dueDate?: Date | null; notes?: string | null; lines?: DocLineInput[] } & DiscountPatch,
  scope?: StaffScope,
) {
  const existing = await getInvoice(id);
  if (existing.status !== 'DRAFT') throw ApiError.conflict('Une proforma envoyée ne peut plus être modifiée.');
  if (patch.lines) patch = { ...patch, lines: await lockLinesToCatalogue(patch.lines, scope) };

  const { lines, discountType: _type, discountValue: _value, ...rest } = patch;
  const vatRate = patch.vatRate ?? Number(existing.vatRate);
  const currentLines = lines ?? storedLines(existing.lines);
  const discount = mergeDiscount(patch, existing);
  const totals = computeTotals(currentLines, vatRate, discount);

  await prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.createMany({ data: lineData(lines).map((l) => ({ ...l, invoiceId: id })) });
    }
    await tx.invoice.update({ where: { id }, data: { ...rest, vatRate, discountType: discount.type, discountValue: discount.value, ...totals } });
  });
  return getInvoice(id);
}

export async function deleteDraftInvoice(id: string) {
  const invoice = await getInvoice(id);
  if (invoice.status !== 'DRAFT') throw ApiError.conflict('Seul un brouillon peut être supprimé (une proforma envoyée s’annule).');
  await prisma.invoice.delete({ where: { id } });
}

const PAYMENT_LABEL: Record<InvoicePaymentMethod, string> = {
  BANK_TRANSFER: 'virement bancaire',
  CASH: 'espèces',
  CHEQUE: 'chèque',
  CARD: 'carte bancaire',
};

/** Facture définitive dès qu'elle a son numéro FA-… (au paiement) ; proforma avant. */
export const invoiceNumberLabel = (invoice: { number: string | null; proformaNumber: string | null }) => invoice.number ?? invoice.proformaNumber ?? 'BROUILLON';

export async function invoicePdf(id: string) {
  const invoice = await getInvoice(id);
  const input: PdfDocumentInput = {
    kind: invoice.number ? 'INVOICE' : 'PROFORMA',
    number: invoiceNumberLabel(invoice),
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
    lines: storedLines(invoice.lines),
    vatRate: Number(invoice.vatRate),
    subtotal: Number(invoice.subtotal),
    discountLabel: discountLabel(invoice),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    notes: invoice.notes,
    stamp:
      invoice.status === 'PAID'
        ? 'PAYÉE'
        : invoice.status === 'REFUNDED'
          ? 'REMBOURSÉE'
          : invoice.status === 'CANCELLED'
            ? 'ANNULÉE'
            : invoice.status === 'DRAFT'
              ? 'BROUILLON'
              : null,
    paymentInfo:
      invoice.status === 'PAID' && invoice.paidAt && invoice.paymentMethod
        ? `Payée le ${invoice.paidAt.toLocaleDateString('fr-FR')} par ${PAYMENT_LABEL[invoice.paymentMethod]}${invoice.paymentRef ? ` (réf. ${invoice.paymentRef})` : ''}.`
        : null,
  };
  return { number: input.number, buffer: await renderDocumentPdf(input) };
}

function invoiceEmailHtml(invoice: Awaited<ReturnType<typeof getInvoice>>, intro: string) {
  const proforma = !invoice.number;
  return [
    `<p>Bonjour ${escapeHtml(invoice.customerName)},</p>`,
    `<p>${intro}</p>`,
    `<p><strong>${proforma ? 'Facture proforma' : 'Facture'} ${invoiceNumberLabel(invoice)} — ${formatAmount(Number(invoice.total))} TTC</strong>${proforma && invoice.dueDate ? `<br>À régler avant le ${invoice.dueDate.toLocaleDateString('fr-FR')}` : ''}</p>`,
    proforma
      ? '<p>Le règlement se fait en espèces à l’accueil ou par virement. Après un virement, déposez votre justificatif dans votre espace IN NETWORK (rubrique « Devis et factures ») : votre espace s’active dès la confirmation du paiement.</p>'
      : '',
    '<p>Le document est joint à ce message au format PDF.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ].join('');
}

async function emailInvoice(id: string, subject: string, intro: string) {
  const invoice = await getInvoice(id);
  if (!invoice.customerEmail) return { emailed: false as const, emailError: 'Aucune adresse email sur la facture.' };
  const number = invoiceNumberLabel(invoice);
  try {
    const { buffer } = await invoicePdf(id);
    await sendEmail({
      to: invoice.customerEmail,
      subject: `${subject} ${number} — IN NETWORK`,
      html: invoiceEmailHtml(invoice, intro),
      attachments: [{ filename: `${number}.pdf`, content: buffer }],
    });
    return { emailed: true as const };
  } catch (err) {
    console.error('[invoices] échec envoi email', err);
    return { emailed: false as const, emailError: err instanceof Error ? err.message : 'Envoi impossible' };
  }
}

/** Envoie la facture proforma : numéro PF-…, échéance, PDF par e-mail ; le client est prévenu dans son espace. */
export async function issueInvoice(id: string, input: { dueDate?: Date; send?: boolean }, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status !== 'DRAFT') throw ApiError.conflict('Cette proforma est déjà envoyée.');
  if (invoice.lines.length === 0) throw ApiError.badRequest('Ajoutez au moins une ligne avant d’envoyer la proforma.');
  if (Number(invoice.total) <= 0) throw ApiError.badRequest('Le montant doit être supérieur à zéro.');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        proformaNumber: await nextNumber('PF', tx),
        status: 'SENT',
        issueDate: now,
        dueDate: input.dueDate ?? invoice.dueDate ?? new Date(now.getTime() + DEFAULT_PAYMENT_DELAY_DAYS * 24 * 3600 * 1000),
      },
    });
  });

  const issued = await getInvoice(id);
  const mail = input.send ? await emailInvoice(id, 'Votre facture proforma', 'Veuillez trouver ci-dessous votre facture proforma.') : null;
  if (issued.leadId) {
    await logActivity(issued.leadId, {
      content: `Facture proforma ${issued.proformaNumber} envoyée${mail?.emailed ? ` à ${issued.customerEmail}` : ''}${mail && !mail.emailed ? ` (email non envoyé : ${mail.emailError})` : ''}.`,
      authorId: actorId,
    });
    await advanceStageTo(issued.leadId, 'CONFIRMED', actorId);
  }
  if (issued.lead?.userId) {
    await notifyUsers([issued.lead.userId], 'proforma_received', 'Facture proforma à régler', `${issued.proformaNumber} — ${formatAmount(Number(issued.total))} TTC. Après un virement, déposez votre justificatif.`, '/dashboard/documents');
  }
  return { invoice: issued, emailed: mail?.emailed ?? false, emailError: mail && !mail.emailed ? mail.emailError : undefined };
}

export async function sendInvoice(id: string, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'DRAFT') throw ApiError.conflict('Envoyez d’abord la proforma.');
  const paid = invoice.status === 'PAID';
  const mail = await emailInvoice(
    id,
    paid ? 'Votre facture acquittée' : 'Votre facture proforma',
    paid ? 'Veuillez trouver ci-dessous votre facture acquittée.' : 'Veuillez trouver ci-dessous votre facture proforma.',
  );
  if (invoice.leadId) {
    const number = invoiceNumberLabel(invoice);
    await logActivity(invoice.leadId, {
      content: mail.emailed ? `${number} envoyée à ${invoice.customerEmail}.` : `Envoi de ${number} impossible : ${mail.emailError}`,
      authorId: actorId,
    });
  }
  return mail;
}

/**
 * Paiement encaissé (espèces ou virement) : le fait générateur de toute la
 * suite. Facture définitive numérotée, client gagné, espace membre ouvert et
 * déverrouillé, services ajoutés au panier du membre, commissions calculées.
 */
export async function recordPayment(
  id: string,
  input: { method: InvoicePaymentMethod; paidAt?: Date; reference?: string | null },
  actorId: string,
) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'PAID') throw ApiError.conflict('Cette facture est déjà payée.');
  if (invoice.status !== 'SENT') throw ApiError.conflict('Envoyez la proforma avant d’enregistrer son paiement.');
  if (invoice.lead?.channel && DIASPORA_CHANNELS.includes(invoice.lead.channel) && input.method !== 'BANK_TRANSFER') {
    throw ApiError.badRequest('Client de la diaspora : le paiement se fait par virement.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: input.paidAt ?? new Date(),
        paymentMethod: input.method,
        paymentRef: input.reference ?? null,
        // Les factures émises avant la proforma ont déjà leur numéro définitif.
        ...(invoice.number ? {} : { number: await nextNumber('FA', tx) }),
      },
    });
  });
  const paid = await getInvoice(id);

  let memberId: string | null = null;
  if (paid.leadId) {
    await logActivity(paid.leadId, {
      content: `Paiement de ${formatAmount(round2(Number(paid.total)))} encaissé (${PAYMENT_LABEL[input.method]}) : facture ${paid.number}.`,
      authorId: actorId,
    });
    await advanceStageTo(paid.leadId, 'PAID', actorId);
    memberId = await ensureMemberAccount(paid.leadId);
    if (memberId) await activateMember(memberId, paid.leadId, actorId);
  }

  // Services ajoutés au panier du membre (commandes, checklists, abonnement), puis commissions.
  const orders = await launchServicesForInvoice(id, actorId);
  await createCommissionsForInvoice(id).catch((err) => console.error('[commissions] calcul impossible', err));
  emailInvoice(id, 'Votre facture acquittée', 'Nous avons bien reçu votre paiement, merci. Voici votre facture acquittée.').catch(() => undefined);
  return { invoice: await getInvoice(id), orders };
}

export async function cancelInvoice(id: string, reason: string, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status === 'PAID') throw ApiError.conflict('Une facture payée ne s’annule pas : enregistrez un remboursement.');
  if (invoice.status === 'DRAFT') throw ApiError.conflict('Supprimez plutôt le brouillon.');
  if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') return invoice;
  await prisma.invoice.update({
    where: { id },
    data: { status: 'CANCELLED', notes: [invoice.notes, `Annulée : ${reason}`].filter(Boolean).join('\n') },
  });
  if (invoice.leadId) await logActivity(invoice.leadId, { content: `${invoiceNumberLabel(invoice)} annulée (${reason}).`, authorId: actorId });
  return getInvoice(id);
}

/** Remboursement d'une facture payée : les commissions sont reprises. */
export async function refundInvoice(id: string, reason: string, actorId: string) {
  const invoice = await getInvoice(id);
  if (invoice.status !== 'PAID') throw ApiError.conflict('Seule une facture payée se rembourse.');
  await prisma.invoice.update({ where: { id }, data: { status: 'REFUNDED', refundedAt: new Date(), refundReason: reason } });
  const cancelled = await cancelCommissionsForInvoice(id, reason);
  if (invoice.leadId) {
    await logActivity(invoice.leadId, {
      content: `Facture ${invoice.number} remboursée (${reason})${cancelled ? ` — ${cancelled} commission${cancelled > 1 ? 's' : ''} reprise${cancelled > 1 ? 's' : ''}` : ''}.`,
      authorId: actorId,
    });
  }
  return getInvoice(id);
}
