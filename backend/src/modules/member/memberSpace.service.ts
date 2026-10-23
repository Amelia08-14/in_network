import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { getSettings } from '../settings/settings.service';
import { isAccountValidated } from '../situation/accountState';
import { requestProgress } from '../situation/situation.service';
import { DOCUMENT_KIND_LABEL, ORDER_STATUS_LABEL, POLE_LABEL, memberServiceStatus, requestAdjustment, validateOrder } from '../crm/fulfilment.service';
import { createMemberLead, createReferralLead } from '../crm/leadIntake.service';
import { createQuote, sendQuote, type DocLineInput } from '../crm/quotes.service';
import { logActivity } from '../crm/leads.service';
import { STAFF_SELECT, notifyUsers, staffName } from '../crm/staff';

// Espace client du membre (phase 7 du processus v1.3) :
//   1. suivre l'évolution de chaque service (panier) ;
//   2. demander d'autres services (catalogue + panier de devis, cf. services.routes) ;
//   3. consulter son historique de consommation ;
//   4. connaître ses échéances (alertes J-60 / J-30 / J-7, cf. automatisations) ;
//   5. renouveler en un clic.
// Et la fidélisation : référent, ancienneté, recommandations de contacts.

const DAY = 24 * 3600 * 1000;

interface PricingTier {
  label: string;
  price: number;
}
const tiersOf = (value: unknown): PricingTier[] => (Array.isArray(value) ? (value as PricingTier[]) : []);

/** Renouvellement déjà demandé : une ligne de devis en cours le prolonge. */
async function pendingRenewals(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, string>();
  const lines = await prisma.quoteLine.findMany({
    where: { renewsOrderId: { in: orderIds }, quote: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACCEPTED'] }, lead: { stage: { notIn: ['PAID', 'LOST'] } } } },
    select: { renewsOrderId: true, quote: { select: { status: true } } },
  });
  return new Map(lines.map((l) => [l.renewsOrderId!, l.quote.status]));
}

export async function listMyServices(userId: string) {
  const [orders, settings] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { userId },
      include: {
        tasks: { select: { isDone: true } },
        assignedTo: { select: STAFF_SELECT },
        renewedBy: { select: { id: true } },
        renewedFrom: { select: { id: true, title: true } },
        documents: { select: { id: true, kind: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        invoice: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getSettings(),
  ]);
  const renewWindow = Math.max(...settings.expiryAlertDays, 0);
  const renewals = await pendingRenewals(orders.map((o) => o.id));
  const now = new Date();
  return orders.map((order) => {
    const status = memberServiceStatus(order, renewWindow, now);
    const done = order.tasks.filter((t) => t.isDone).length;
    return {
      id: order.id,
      title: order.title,
      pole: order.pole,
      poleLabel: POLE_LABEL[order.pole],
      subsidiary: order.subsidiary,
      amount: order.amount,
      status,
      deliveryStatus: order.status,
      deliveryLabel: ORDER_STATUS_LABEL[order.status],
      progress: order.tasks.length ? Math.round((done / order.tasks.length) * 100) : null,
      startsAt: order.startsAt,
      expiresAt: order.expiresAt,
      daysLeft: order.expiresAt ? Math.ceil((order.expiresAt.getTime() - now.getTime()) / DAY) : null,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
      adjustmentNote: order.adjustmentNote,
      intervenant: order.assignedTo ? staffName(order.assignedTo) : null,
      invoice: order.invoice,
      renewedFrom: order.renewedFrom,
      renewalStatus: renewals.get(order.id) ?? null,
      canRenew: Boolean(order.expiresAt) && ['ACTIVE', 'TO_RENEW', 'EXPIRED'].includes(status) && !renewals.has(order.id),
      documents: order.documents.map((d) => ({ ...d, kindLabel: DOCUMENT_KIND_LABEL[d.kind] })),
      createdAt: order.createdAt,
    };
  });
}

async function ownedOrder(userId: string, orderId: string) {
  const order = await prisma.serviceOrder.findFirst({ where: { id: orderId, userId }, select: { id: true } });
  if (!order) throw ApiError.notFound('Service introuvable');
  return order.id;
}

export async function validateMyService(userId: string, orderId: string) {
  await validateOrder(await ownedOrder(userId, orderId), { id: userId, isMember: true });
  return listMyServices(userId);
}

export async function adjustMyService(userId: string, orderId: string, note: string) {
  await requestAdjustment(await ownedOrder(userId, orderId), note, { id: userId, isMember: true });
  return listMyServices(userId);
}

/**
 * Renouvellement depuis le panier : un lead « Renouvellement » rattaché à la
 * fiche membre, et un devis au tarif du catalogue du jour, envoyé
 * automatiquement si le tarif est défini.
 */
export async function renewMyService(userId: string, orderId: string) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, userId },
    include: { invoiceLine: true, renewedBy: { select: { id: true } } },
  });
  if (!order) throw ApiError.notFound('Service introuvable');
  if (order.status !== 'DONE' || !order.expiresAt) throw ApiError.conflict('Ce service ne se renouvelle pas.');
  if (order.renewedBy) throw ApiError.conflict('Ce service est déjà renouvelé.');
  if ((await pendingRenewals([order.id])).size) throw ApiError.conflict('Le renouvellement de ce service est déjà en cours.');

  const line = order.invoiceLine;
  let unitPrice = line ? Number(line.unitPrice) : Number(order.amount ?? 0);
  if (line?.serviceId) {
    const service = await prisma.serviceCatalogItem.findUnique({ where: { id: line.serviceId }, select: { priceFrom: true, pricingTiers: true } });
    const tierPrice = line.tierLabel ? tiersOf(service?.pricingTiers).find((t) => t.label === line.tierLabel)?.price : undefined;
    unitPrice = Number(tierPrice ?? service?.priceFrom ?? unitPrice);
  } else if (line?.planId) {
    const plan = await prisma.membershipPlan.findUnique({ where: { id: line.planId }, select: { price: true } });
    if (plan) unitPrice = Number(plan.price);
  }
  const quoteLine: DocLineInput = {
    description: `Renouvellement — ${order.title}`,
    quantity: line ? Number(line.quantity) : 1,
    unitPrice,
    serviceId: line?.serviceId,
    planId: line?.planId,
    spaceId: line?.spaceId,
    tierLabel: line?.tierLabel,
    renewsOrderId: order.id,
  };

  const lead = await createMemberLead(userId, { kind: 'RENEWAL', title: `Renouvellement — ${order.title}`, expectedAmount: unitPrice * quoteLine.quantity });
  const quote = await createQuote({ leadId: lead.id, lines: [quoteLine] }, lead.assignedToId);
  try {
    await sendQuote(quote.id, lead.assignedToId);
  } catch (err) {
    await logActivity(lead.id, { content: `Devis ${quote.number} de renouvellement à finaliser : ${err instanceof Error ? err.message : 'envoi impossible'}` });
    if (lead.assignedToId) await notifyUsers([lead.assignedToId], 'quote_to_finalize', 'Devis de renouvellement à finaliser', `${quote.number} — ${order.title}`, `/admin/devis/${quote.id}`);
  }
  return listMyServices(userId);
}

// --- Historique de consommation -------------------------------------------------------

export async function getMyHistory(userId: string) {
  const now = new Date();
  const [subscriptions, bookings, registrations, quotes, invoices, proofs, documents, orders] = await Promise.all([
    prisma.subscription.findMany({ where: { userId }, include: { plan: { select: { name: true, includedMeetingHours: true, billingCycle: true } } }, orderBy: { startDate: 'desc' } }),
    prisma.booking.findMany({ where: { userId }, include: { space: { select: { name: true, type: true } } }, orderBy: { startAt: 'desc' }, take: 200 }),
    prisma.eventRegistration.findMany({ where: { userId }, include: { event: { select: { id: true, title: true, slug: true, startAt: true, type: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.quote.findMany({ where: { lead: { userId }, status: { notIn: ['DRAFT', 'PENDING_APPROVAL'] } }, select: { id: true, number: true, status: true, total: true, sentAt: true, acceptedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findMany({ where: { lead: { userId }, status: { not: 'DRAFT' } }, select: { id: true, number: true, proformaNumber: true, status: true, total: true, issueDate: true, paidAt: true, paymentMethod: true }, orderBy: { createdAt: 'desc' } }),
    prisma.paymentProof.findMany({ where: { userId }, select: { id: true, status: true, fileName: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.memberDocument.findMany({ where: { userId }, select: { id: true, kind: true, title: true, fileName: true, createdAt: true, order: { select: { title: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.serviceOrder.findMany({ where: { userId }, select: { id: true, title: true, status: true, createdAt: true, completedAt: true, startsAt: true, expiresAt: true, renewedFromId: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  // Heures de salle de réunion utilisées sur la période de l'abonnement en cours, face au forfait.
  const active = subscriptions.find((s) => s.status === 'ACTIVE' && s.startDate <= now && s.endDate >= now) ?? null;
  const meetingHoursUsed = active
    ? bookings
        .filter((b) => b.space.type === 'MEETING_ROOM' && ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.startAt >= active.startDate && b.startAt <= active.endDate)
        .reduce((sum, b) => sum + (b.endAt.getTime() - b.startAt.getTime()) / 3600_000, 0)
    : 0;

  type Entry = { date: Date; kind: 'service' | 'payment' | 'quote' | 'event' | 'booking' | 'document'; label: string; detail?: string };
  const timeline: Entry[] = [
    ...orders.map((o) => ({ date: o.createdAt, kind: 'service' as const, label: o.renewedFromId ? `Renouvellement : ${o.title}` : `Service souscrit : ${o.title}` })),
    ...orders.filter((o) => o.completedAt && !o.renewedFromId).map((o) => ({ date: o.completedAt!, kind: 'service' as const, label: `Service livré : ${o.title}` })),
    ...invoices.filter((i) => i.paidAt).map((i) => ({ date: i.paidAt!, kind: 'payment' as const, label: `Paiement — facture ${i.number}`, detail: `${Number(i.total).toLocaleString('fr-FR')} DA` })),
    ...quotes.filter((q) => q.sentAt).map((q) => ({ date: q.sentAt!, kind: 'quote' as const, label: `Devis ${q.number} reçu`, detail: `${Number(q.total).toLocaleString('fr-FR')} DA` })),
    ...registrations.filter((r) => r.status !== 'CANCELLED').map((r) => ({ date: r.event.startAt, kind: 'event' as const, label: `${r.status === 'ATTENDED' ? 'Événement suivi' : 'Inscription'} : ${r.event.title}` })),
    ...bookings.filter((b) => ['CONFIRMED', 'COMPLETED'].includes(b.status)).map((b) => ({ date: b.startAt, kind: 'booking' as const, label: `Réservation : ${b.space.name}` })),
    ...documents.map((d) => ({ date: d.createdAt, kind: 'document' as const, label: `Document remis : ${d.title}` })),
  ]
    .filter((e) => e.date <= now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 80);

  return {
    consumption: {
      plan: active ? { name: active.plan.name, startDate: active.startDate, endDate: active.endDate, includedMeetingHours: active.plan.includedMeetingHours } : null,
      meetingHoursUsed: Math.round(meetingHoursUsed * 10) / 10,
      bookingsCount: bookings.filter((b) => ['CONFIRMED', 'COMPLETED'].includes(b.status)).length,
      eventsAttended: registrations.filter((r) => r.status === 'ATTENDED').length,
      eventsRegistered: registrations.filter((r) => r.status !== 'CANCELLED').length,
    },
    subscriptions: subscriptions.map((s) => ({ id: s.id, plan: s.plan.name, status: s.status, startDate: s.startDate, endDate: s.endDate })),
    events: registrations.map((r) => ({ id: r.id, status: r.status, event: r.event })),
    quotes,
    invoices,
    proofs,
    documents: documents.map((d) => ({ ...d, kindLabel: DOCUMENT_KIND_LABEL[d.kind] })),
    timeline,
  };
}

export async function getOwnedDocument(userId: string, documentId: string) {
  const document = await prisma.memberDocument.findFirst({ where: { id: documentId, userId } });
  if (!document) throw ApiError.notFound('Document introuvable');
  return document;
}

// --- Accueil & fidélité ------------------------------------------------------------------

export async function getMyOverview(userId: string) {
  const [validated, user, services, referrals, upcomingEvents, firstWin, pendingQuotes, proformas, requests] = await Promise.all([
    isAccountValidated(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, referent: { select: { ...STAFF_SELECT, phone: true } }, profile: { select: { firstName: true } } },
    }),
    listMyServices(userId),
    prisma.lead.findMany({ where: { referrerUserId: userId }, select: { id: true, contactName: true, stage: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.event.findMany({ where: { status: 'PUBLISHED', startAt: { gte: new Date() } }, select: { id: true, title: true, slug: true, startAt: true, type: true }, orderBy: { startAt: 'asc' }, take: 3 }),
    prisma.lead.findFirst({ where: { userId, stage: 'PAID' }, select: { wonAt: true }, orderBy: { wonAt: 'asc' } }),
    prisma.quote.count({ where: { lead: { userId }, status: 'SENT' } }),
    prisma.invoice.count({ where: { lead: { userId }, status: 'SENT' } }),
    prisma.serviceRequest.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      select: { status: true, lead: { select: { stage: true, quotes: { select: { status: true } } } } },
    }),
  ]);
  const active = services.filter((s) => ['ACTIVE', 'TO_RENEW'].includes(s.status));
  return {
    validated,
    firstName: user?.profile?.firstName ?? null,
    memberSince: firstWin?.wonAt ?? null,
    referent: user?.referent ? { name: staffName(user.referent), email: user.referent.email, phone: user.referent.phone } : null,
    actions: {
      quotesToConfirm: pendingQuotes,
      proformasToPay: proformas,
      servicesToValidate: services.filter((s) => s.status === 'AWAITING_VALIDATION').length,
      servicesToRenew: services.filter((s) => s.status === 'TO_RENEW' && s.canRenew).length,
    },
    /** Demandes envoyées dont l'équipe prépare le devis (rien à faire côté membre). */
    requestsInPricing: requests.filter((r) => requestProgress(r) === 'PRICING').length,
    services: {
      active: active.length,
      activating: services.filter((s) => ['ACTIVATING', 'AWAITING_VALIDATION', 'ADJUSTMENT_REQUESTED'].includes(s.status)).length,
      total: services.length,
      nextExpiries: active.filter((s) => s.expiresAt).sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime()).slice(0, 3),
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      contactName: r.contactName,
      createdAt: r.createdAt,
      status: r.stage === 'PAID' ? 'Devenu membre' : r.stage === 'LOST' ? 'Sans suite' : 'En cours',
    })),
    upcomingEvents,
  };
}

export async function referContact(userId: string, input: { contactName: string; email?: string | null; phone?: string | null; companyName?: string | null; need?: string | null }) {
  if (!input.email && !input.phone) throw ApiError.badRequest('Indiquez au moins un e-mail ou un téléphone pour que nous puissions contacter cette personne.');
  const { alreadyKnown } = await createReferralLead(userId, input);
  return { alreadyKnown };
}
