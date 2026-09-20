import fs from 'node:fs';
import type { PaymentProofStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { env } from '../../config/env';
import { ApiError } from '../../utils/apiResponse';
import { getProfileCompleteness } from '../profiles/profiles.service';
import { logActivity } from '../crm/leads.service';
import { formatAmount } from '../crm/money';
import { recordPayment } from '../crm/invoices.service';
import { decideQuote } from '../crm/quotes.service';
import { STAFF_SELECT, listStaffWith, notifyUsers } from '../crm/staff';
import { isAccountValidated } from './accountState';

// « Situation du compte » : ce que voit un membre tant que son compte n'est pas
// validé — avancement de sa validation, ses devis, ses factures, et l'envoi de
// son justificatif de paiement. Tout est borné à SES données (lead.userId).

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export async function getSituation(userId: string) {
  const [validated, completeness, user, requests, quotes, invoices, proofs] = await Promise.all([
    isAccountValidated(userId),
    getProfileCompleteness(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        profile: { select: { firstName: true, lastName: true, memberType: true, companyName: true } },
        company: { select: { name: true, seatLimit: true } },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Les brouillons de l'équipe ne sont jamais visibles par le client.
    prisma.quote.findMany({
      where: { lead: { userId }, status: { not: 'DRAFT' } },
      include: { lines: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { lead: { userId }, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paymentProof.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        fileName: true,
        mimeType: true,
        amount: true,
        reference: true,
        note: true,
        reviewNote: true,
        createdAt: true,
        quote: { select: { number: true } },
        invoice: { select: { number: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    validated,
    account: {
      email: user?.email ?? '',
      name: user?.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : null,
      isCompany: Boolean(user?.company),
      companyName: user?.company?.name ?? user?.profile?.companyName ?? null,
      seatLimit: user?.company?.seatLimit ?? null,
    },
    completeness,
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      items: r.items.map((i) => ({ id: i.id, title: i.title, tierLabel: i.tierLabel })),
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      status: q.status,
      subtotal: q.subtotal,
      total: q.total,
      vatRate: q.vatRate,
      validUntil: q.validUntil,
      sentAt: q.sentAt,
      notes: q.notes,
      lines: q.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
    })),
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, status: i.status, total: i.total, dueDate: i.dueDate, paidAt: i.paidAt })),
    proofs,
    // Coordonnées de règlement : uniquement si l'entreprise les a renseignées (jamais inventées).
    paymentInstructions: { holder: env.company.name, rib: env.company.rib || null },
  };
}

// --- Devis : acceptation par le client ---------------------------------------

async function ownedQuote(userId: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, lead: { userId }, status: { not: 'DRAFT' } },
    select: { id: true, number: true, leadId: true, status: true, total: true },
  });
  if (!quote) throw ApiError.notFound('Devis introuvable');
  return quote;
}

export async function ownedInvoiceId(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, lead: { userId }, status: { not: 'DRAFT' } }, select: { id: true } });
  if (!invoice) throw ApiError.notFound('Facture introuvable');
  return invoice.id;
}

export async function ownedQuoteId(userId: string, quoteId: string) {
  return (await ownedQuote(userId, quoteId)).id;
}

export async function answerQuote(userId: string, quoteId: string, decision: 'ACCEPTED' | 'REJECTED') {
  const quote = await ownedQuote(userId, quoteId);
  await decideQuote(quote.id, decision, userId);
  const recipients = await listStaffWith('crm');
  await notifyUsers(
    recipients.map((u) => u.id),
    decision === 'ACCEPTED' ? 'quote_accepted' : 'quote_rejected',
    decision === 'ACCEPTED' ? 'Devis accepté par le client' : 'Devis refusé par le client',
    `${quote.number} (${formatAmount(Number(quote.total))} TTC) a été ${decision === 'ACCEPTED' ? 'accepté' : 'refusé'} par le client depuis son espace.`,
  );
  return quote.id;
}

// --- Justificatifs de paiement ---------------------------------------------------

export interface ProofFields {
  note?: string;
  reference?: string;
  amount?: number;
  quoteId?: string;
  invoiceId?: string;
}

export async function createProof(userId: string, file: Express.Multer.File, fields: ProofFields) {
  const quoteId = fields.quoteId ? await ownedQuoteId(userId, fields.quoteId) : undefined;
  const invoiceId = fields.invoiceId ? await ownedInvoiceId(userId, fields.invoiceId) : undefined;

  const proof = await prisma.paymentProof.create({
    data: {
      userId,
      quoteId,
      invoiceId,
      filePath: file.filename,
      fileName: file.originalname.slice(0, 190),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      amount: fields.amount,
      reference: fields.reference?.slice(0, 190),
      note: fields.note?.slice(0, 2000),
    },
    include: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
  });

  // Fil du lead (devis, facture, sinon le lead le plus récent du membre).
  let leadId: string | null = null;
  if (quoteId) leadId = (await prisma.quote.findUnique({ where: { id: quoteId }, select: { leadId: true } }))?.leadId ?? null;
  if (!leadId && invoiceId) leadId = (await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { leadId: true } }))?.leadId ?? null;
  if (!leadId) leadId = (await prisma.lead.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } }))?.id ?? null;
  if (leadId) {
    await logActivity(leadId, { content: `Le client a envoyé un justificatif de paiement (${proof.fileName}).`, authorId: userId });
  }

  const name = proof.user.profile ? `${proof.user.profile.firstName} ${proof.user.profile.lastName}`.trim() : proof.user.email;
  const recipients = await listStaffWith('invoices');
  await notifyUsers(
    recipients.map((u) => u.id),
    'payment_proof',
    'Justificatif de paiement reçu',
    `${name} a envoyé un justificatif de paiement à vérifier.`,
  );
  return proof;
}

export async function getOwnedProofFile(userId: string, proofId: string) {
  const proof = await prisma.paymentProof.findFirst({ where: { id: proofId, userId } });
  if (!proof) throw ApiError.notFound('Justificatif introuvable');
  return proof;
}

// --- Côté équipe : vérification des justificatifs ------------------------------------

export async function listProofs(filter: { status?: PaymentProofStatus; userId?: string }) {
  return prisma.paymentProof.findMany({
    where: { status: filter.status, userId: filter.userId },
    include: {
      user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, isPublic: true } } } },
      quote: { select: { id: true, number: true, total: true, leadId: true } },
      invoice: { select: { id: true, number: true, status: true, total: true, leadId: true } },
      reviewedBy: { select: STAFF_SELECT },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function getProofForStaff(proofId: string) {
  const proof = await prisma.paymentProof.findUnique({ where: { id: proofId } });
  if (!proof) throw ApiError.notFound('Justificatif introuvable');
  return proof;
}

/** Validation d'un compte membre : débloque tout l'espace, prévient le membre. */
export async function approveAccount(userId: string, actorId: string) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { isPublic: true, firstName: true } });
  if (!profile) throw ApiError.notFound('Profil introuvable');
  if (profile.isPublic) return { alreadyValidated: true };

  await prisma.memberProfile.update({ where: { userId }, data: { isPublic: true } });
  await notifyUsers([userId], 'account_validated', 'Votre compte est validé', 'Bienvenue ! Toutes les fonctionnalités de votre espace membre sont maintenant disponibles.');

  const leads = await prisma.lead.findMany({ where: { userId }, select: { id: true } });
  for (const lead of leads) await logActivity(lead.id, { content: 'Compte membre validé : l’espace du client est déverrouillé.', authorId: actorId });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user) {
    sendEmail({
      to: user.email,
      subject: 'IN NETWORK — Votre compte est validé',
      html: `<p>Bonjour ${escapeHtml(profile.firstName)},</p><p>Bonne nouvelle : votre compte IN NETWORK est validé. Votre espace membre est maintenant entièrement accessible : <a href="${env.appUrl}/dashboard">accéder à mon espace</a>.</p><p>L’équipe IN NETWORK</p>`,
    }).catch((err) => console.error('[situation] échec email de validation', err));
  }
  return { alreadyValidated: false };
}

export async function reviewProof(
  proofId: string,
  input: { decision: 'ACCEPT' | 'REJECT'; reviewNote?: string; recordPayment?: boolean; validateAccount?: boolean },
  actorId: string,
) {
  const proof = await prisma.paymentProof.findUnique({ where: { id: proofId }, include: { invoice: { select: { id: true, status: true, number: true } } } });
  if (!proof) throw ApiError.notFound('Justificatif introuvable');
  if (proof.status !== 'PENDING') throw ApiError.conflict('Ce justificatif a déjà été traité.');
  if (input.decision === 'REJECT' && !input.reviewNote?.trim()) throw ApiError.badRequest('Indiquez le motif du refus : le client le verra.');

  // Le paiement se déclenche avant de clore le justificatif : en cas d'échec
  // (facture non émise…) rien n'est modifié et l'erreur est explicite.
  if (input.decision === 'ACCEPT' && input.recordPayment) {
    if (!proof.invoice) throw ApiError.badRequest('Aucune facture n’est rattachée à ce justificatif.');
    if (proof.invoice.status === 'SENT') {
      await recordPayment(proof.invoice.id, { method: 'BANK_TRANSFER', reference: proof.reference ?? `justificatif ${proof.id.slice(-6)}` }, actorId);
    }
  }

  await prisma.paymentProof.update({
    where: { id: proofId },
    data: {
      status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      reviewNote: input.reviewNote?.trim() || null,
      reviewedById: actorId,
      reviewedAt: new Date(),
    },
  });

  if (input.decision === 'ACCEPT') {
    await notifyUsers([proof.userId], 'payment_proof_accepted', 'Justificatif accepté', 'Votre justificatif de paiement a été vérifié et accepté.');
    if (input.validateAccount) await approveAccount(proof.userId, actorId);
  } else {
    await notifyUsers([proof.userId], 'payment_proof_rejected', 'Justificatif refusé', `Votre justificatif n’a pas pu être accepté : ${input.reviewNote!.trim()}. Vous pouvez en envoyer un nouveau depuis « Situation du compte ».`);
  }
  return prisma.paymentProof.findUnique({ where: { id: proofId } });
}

export function removeFileQuietly(absolutePath: string) {
  fs.rm(absolutePath, { force: true }, () => undefined);
}
