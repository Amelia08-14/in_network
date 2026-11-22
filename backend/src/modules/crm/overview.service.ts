import type { DeliveryPole, LeadPipeline, LeadStage } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { STAFF_SELECT, staffName } from './staff';
import { OPEN_STAGES, PIPELINE_LABEL, STAGE_LABEL } from './workflow';

// Tableau de bord de la Direction (retours du 22/11/2026) : la page d'accueil
// de l'administrateur n'est plus « Ma journée » mais une vue d'ensemble
// chiffrée de l'entreprise — chiffre d'affaires, prospects, conversion,
// encaissements, membres, occupation, entonnoir, équipe — sur une période
// choisie et comparée à la période précédente de même durée.

const DAY = 24 * 3600 * 1000;

export type OverviewPeriod = '30d' | '90d' | '12m';
const PERIOD_DAYS: Record<OverviewPeriod, number> = { '30d': 30, '90d': 90, '12m': 365 };

const num = (value: unknown) => Number(value ?? 0);
const sum = <T>(rows: T[], pick: (row: T) => unknown) => rows.reduce((total, row) => total + num(pick(row)), 0);

/** Valeur de la période et de la période précédente, pour l'évolution affichée. */
interface Compared {
  value: number;
  previous: number;
}

const POLE_LABEL: Record<DeliveryPole, string> = {
  SPACES: 'Espaces et domiciliation',
  COMPANY_CREATION: 'Création d’entreprise',
  IN_GROUP: 'Solutions IN Group',
};

const FUNNEL: LeadStage[] = ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED'];

export async function getOverview(period: OverviewPeriod = '30d') {
  const now = new Date();
  const days = PERIOD_DAYS[period];
  const start = new Date(now.getTime() - days * DAY);
  const prevStart = new Date(start.getTime() - days * DAY);
  const inCurrent = { gte: start, lte: now };
  const inPrevious = { gte: prevStart, lt: start };
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    paidNow,
    paidPrev,
    leadsNow,
    leadsPrev,
    wonNow,
    wonPrev,
    lostNow,
    lostPrev,
    quotesNow,
    quotesPrev,
    receivable,
    openLeads,
    paidYear,
    leadsYear,
    wonYear,
    leadsByPipeline,
    ordersPaid,
    staff,
    openByOwner,
    wonByOwner,
    activeMembers,
    newMembersNow,
    newMembersPrev,
    deskCapacity,
    activeSubs,
    expiringSoon,
    alerts,
  ] = await Promise.all([
    prisma.invoice.findMany({ where: { status: 'PAID', paidAt: inCurrent }, select: { total: true } }),
    prisma.invoice.findMany({ where: { status: 'PAID', paidAt: inPrevious }, select: { total: true } }),
    prisma.lead.count({ where: { kind: 'NEW_BUSINESS', createdAt: inCurrent } }),
    prisma.lead.count({ where: { kind: 'NEW_BUSINESS', createdAt: inPrevious } }),
    prisma.lead.count({ where: { stage: 'PAID', wonAt: inCurrent } }),
    prisma.lead.count({ where: { stage: 'PAID', wonAt: inPrevious } }),
    prisma.lead.count({ where: { stage: 'LOST', lostAt: inCurrent } }),
    prisma.lead.count({ where: { stage: 'LOST', lostAt: inPrevious } }),
    prisma.quote.findMany({ where: { sentAt: inCurrent }, select: { total: true } }),
    prisma.quote.findMany({ where: { sentAt: inPrevious }, select: { total: true } }),
    prisma.invoice.findMany({ where: { status: 'SENT' }, select: { total: true, dueDate: true } }),
    prisma.lead.findMany({ where: { stage: { in: OPEN_STAGES } }, select: { stage: true, expectedAmount: true } }),
    prisma.invoice.findMany({ where: { status: 'PAID', paidAt: { gte: yearStart } }, select: { total: true, paidAt: true } }),
    prisma.lead.findMany({ where: { kind: 'NEW_BUSINESS', createdAt: { gte: yearStart } }, select: { createdAt: true } }),
    prisma.lead.findMany({ where: { stage: 'PAID', wonAt: { gte: yearStart } }, select: { wonAt: true } }),
    prisma.lead.groupBy({ by: ['pipeline'], where: { createdAt: inCurrent }, _count: { _all: true } }),
    prisma.serviceOrder.findMany({ where: { invoice: { status: 'PAID', paidAt: inCurrent } }, select: { pole: true, amount: true } }),
    prisma.user.findMany({ where: { role: { in: ['OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT'] }, isActive: true }, select: STAFF_SELECT }),
    prisma.lead.groupBy({ by: ['assignedToId'], where: { stage: { in: OPEN_STAGES } }, _count: { _all: true } }),
    prisma.lead.findMany({
      where: { stage: 'PAID', wonAt: inCurrent },
      select: { assignedToId: true, salesAgentId: true, invoices: { where: { status: 'PAID' }, select: { total: true } } },
    }),
    prisma.user.count({ where: { role: 'MEMBER', memberServiceOrders: { some: { status: 'DONE', OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } } } }),
    prisma.user.count({ where: { role: 'MEMBER', createdAt: inCurrent } }),
    prisma.user.count({ where: { role: 'MEMBER', createdAt: inPrevious } }),
    prisma.spaceResource.aggregate({ where: { type: 'DESK', isActive: true }, _sum: { capacity: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } } }),
    prisma.serviceOrder.count({ where: { status: 'DONE', renewedBy: null, expiredAt: null, expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * DAY) } } }),
    Promise.all([
      prisma.quote.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.paymentProof.count({ where: { status: 'PENDING' } }),
      prisma.lead.count({ where: { stage: 'CONFIRMED' } }),
      prisma.serviceOrder.count({ where: { status: { in: ['TO_START', 'ADJUSTMENT_REQUESTED'] } } }),
      prisma.lead.count({ where: { circuit: null, assignedToId: null, stage: { in: OPEN_STAGES } } }),
      prisma.event.count({ where: { status: 'PENDING_REVIEW' } }),
    ]),
  ]);

  const revenue: Compared = { value: sum(paidNow, (i) => i.total), previous: sum(paidPrev, (i) => i.total) };
  const rate = (won: number, lost: number) => (won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0);
  const overdue = receivable.filter((inv) => inv.dueDate && inv.dueDate < now);
  const capacity = deskCapacity._sum.capacity ?? 0;

  // 12 derniers mois : chiffre d'affaires encaissé, prospects entrants, clients gagnés.
  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  const monthly = months.map((date) => {
    const key = monthKey(date);
    return {
      month: key,
      label: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      revenue: sum(paidYear.filter((i) => i.paidAt && monthKey(i.paidAt) === key), (i) => i.total),
      leads: leadsYear.filter((l) => monthKey(l.createdAt) === key).length,
      won: wonYear.filter((l) => l.wonAt && monthKey(l.wonAt) === key).length,
    };
  });

  // Entonnoir : leads ouverts par étape (nombre et montant attendu).
  const funnel = FUNNEL.map((stage) => {
    const rows = openLeads.filter((l) => l.stage === stage);
    return { stage, label: STAGE_LABEL[stage], count: rows.length, amount: sum(rows, (l) => l.expectedAmount) };
  });

  const sources = leadsByPipeline
    .map((row) => ({ pipeline: row.pipeline as LeadPipeline | null, label: row.pipeline ? PIPELINE_LABEL[row.pipeline] : 'Non renseignée', count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  const byPole = (Object.keys(POLE_LABEL) as DeliveryPole[])
    .map((pole) => ({ pole, label: POLE_LABEL[pole], amount: sum(ordersPaid.filter((o) => o.pole === pole), (o) => o.amount) }))
    .sort((a, b) => b.amount - a.amount);

  // Équipe : leads en cours, clients gagnés et CA encaissé sur la période.
  const team = staff
    .map((user) => {
      const won = wonByOwner.filter((l) => l.salesAgentId === user.id || (!l.salesAgentId && l.assignedToId === user.id));
      return {
        id: user.id,
        name: staffName(user),
        role: user.role,
        open: openByOwner.find((row) => row.assignedToId === user.id)?._count._all ?? 0,
        won: won.length,
        revenue: won.reduce((total, l) => total + sum(l.invoices, (i) => i.total), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.won - a.won || b.open - a.open);

  const [approvals, proofs, toCollect, toDeliver, unassigned, events] = alerts;

  return {
    period,
    from: start,
    to: now,
    kpis: {
      revenue,
      paidInvoices: { value: paidNow.length, previous: paidPrev.length },
      averageBasket: { value: paidNow.length ? revenue.value / paidNow.length : 0, previous: paidPrev.length ? revenue.previous / paidPrev.length : 0 },
      newLeads: { value: leadsNow, previous: leadsPrev },
      won: { value: wonNow, previous: wonPrev },
      conversion: { value: rate(wonNow, lostNow), previous: rate(wonPrev, lostPrev), closed: wonNow + lostNow },
      quotesSent: { value: quotesNow.length, previous: quotesPrev.length, amount: sum(quotesNow, (q) => q.total) },
      newMembers: { value: newMembersNow, previous: newMembersPrev },
    },
    snapshot: {
      receivable: sum(receivable, (i) => i.total),
      receivableCount: receivable.length,
      overdue: sum(overdue, (i) => i.total),
      overdueCount: overdue.length,
      pipelineAmount: sum(openLeads, (l) => l.expectedAmount),
      openLeads: openLeads.length,
      activeMembers,
      occupancy: capacity ? Math.round((activeSubs / capacity) * 100) : null,
      activeSubs,
      capacity,
      expiringSoon,
    },
    monthly,
    funnel,
    sources,
    byPole,
    team,
    alerts: [
      { key: 'approvals', label: 'Remises et devis à valider', count: approvals, href: '/admin/validations' },
      { key: 'proofs', label: 'Justificatifs de paiement à vérifier', count: proofs, href: '/admin/factures?tab=justificatifs' },
      { key: 'to_collect', label: 'Devis acceptés : paiement à organiser', count: toCollect, href: '/admin/crm/pipeline?queue=to_call' },
      { key: 'overdue', label: 'Proformas échues non payées', count: overdue.length, href: '/admin/factures?status=SENT' },
      { key: 'to_deliver', label: 'Services à lancer', count: toDeliver, href: '/admin/lancements' },
      { key: 'unassigned', label: 'Prospects sans intervenant', count: unassigned, href: '/admin/crm/entrants' },
      { key: 'events', label: 'Événements à modérer', count: events, href: '/admin/evenements' },
    ].filter((alert) => alert.count > 0),
  };
}
