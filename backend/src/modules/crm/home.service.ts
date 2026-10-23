import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ROLE_LABELS, isStaffRole } from '../admin/permissions';
import { getSettings } from '../settings/settings.service';
import { orderScopeWhere } from './fulfilment.service';
import { queueWhere } from './leads.service';
import { leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, staffName } from './staff';
import { CIRCUIT_LABEL, OPEN_STAGES, PIPELINE_LABEL, STAGE_ORDER, stageLabel } from './workflow';

// « Ma journée » : la page d'accueil du backoffice, propre à chaque profil du
// processus v1.3. D'abord les files d'attente (ce qui attend une action du
// compte), puis l'agenda du jour et, pour la Direction et le responsable
// commercial, les indicateurs de pilotage face aux objectifs du processus.

const DAY = 24 * 3600 * 1000;

export type QueueGroup = 'Prospects' | 'Ventes' | 'Clients' | 'Commissions';

export interface HomeQueue {
  key: string;
  group: QueueGroup;
  label: string;
  hint: string;
  count: number;
  href: string;
  /** Une file en retard ou bloquante s'affiche en alerte. */
  alert?: boolean;
}

const and = (...parts: (Prisma.LeadWhereInput | undefined)[]): Prisma.LeadWhereInput => ({ AND: parts.filter(Boolean) as Prisma.LeadWhereInput[] });

export async function getHome(scope: StaffScope) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + DAY);
  const settings = await getSettings();
  const renewWindow = Math.max(...settings.expiryAlertDays, 0);
  const scoped = leadScopeWhere(scope);
  const me = scope.userId;
  const isSupport = scope.role === 'ADMIN_SUPPORT';
  const hasCrm = !isSupport;
  const ordersScope = orderScopeWhere(scope);

  const tasks: Promise<HomeQueue | null>[] = [];
  const queue = (q: Omit<HomeQueue, 'count'>, count: Promise<number>) => tasks.push(count.then((n) => ({ ...q, count: n })));

  if (scope.manageLeads) {
    queue({ key: 'to_dispatch', group: 'Prospects', label: 'Leads à aiguiller', hint: 'Choisir le circuit 1 ou 2', href: '/admin/crm/entrants' }, prisma.lead.count({ where: and(scoped, queueWhere('to_dispatch')) }));
  }
  if (scope.salesManager || scope.direction) {
    queue({ key: 'to_assign', group: 'Prospects', label: 'Leads à attribuer', hint: 'Circuit 1 : sédentaire ou terrain', href: '/admin/crm/entrants?tab=attribuer' }, prisma.lead.count({ where: and(scoped, queueWhere('to_assign')) }));
    queue(
      { key: 'returned', group: 'Prospects', label: 'Revenus sans réponse', hint: 'Réattribuer ou clôturer', href: '/admin/crm/entrants?tab=relances', alert: true },
      prisma.lead.count({ where: and(scoped, queueWhere('returned'), { circuit: 'SALES_TEAM' }) }),
    );
    queue(
      { key: 'quotes_sales', group: 'Ventes', label: 'Demandes de devis à valider', hint: 'Devis sur mesure du circuit 1', href: '/admin/devis?status=PENDING_APPROVAL' },
      prisma.quote.count({ where: { status: 'PENDING_APPROVAL', lead: { circuit: 'SALES_TEAM' } } }),
    );
    queue(
      { key: 'commissions_check', group: 'Commissions', label: 'Commissions à contrôler', hint: 'Circuit 1, services livrés', href: '/admin/commissions?status=ELIGIBLE' },
      prisma.commission.count({ where: { status: 'ELIGIBLE', lead: { circuit: 'SALES_TEAM' } } }),
    );
  }
  if (scope.direction) {
    queue(
      { key: 'quotes_direction', group: 'Ventes', label: 'Devis à valider (Direction)', hint: 'Circuit 2 ou au-delà du seuil', href: '/admin/devis?status=PENDING_APPROVAL' },
      prisma.quote.count({ where: { status: 'PENDING_APPROVAL', lead: { circuit: { not: 'SALES_TEAM' } } } }),
    );
    queue(
      { key: 'commissions_validate', group: 'Commissions', label: 'Commissions à valider', hint: 'Contrôlées ou éligibles (circuit 2)', href: '/admin/commissions?status=CHECKED' },
      prisma.commission.count({ where: { OR: [{ status: 'CHECKED' }, { status: 'ELIGIBLE', lead: { circuit: { not: 'SALES_TEAM' } } }] } }),
    );
  }
  if (hasCrm) {
    queue(
      { key: 'my_leads', group: 'Prospects', label: 'Mes leads à faire avancer', hint: 'Qualifier, relancer, obtenir la visite', href: '/admin/crm/pipeline?assignee=me' },
      prisma.lead.count({ where: { assignedToId: me, stage: { in: ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP'] } } }),
    );
    queue(
      { key: 'follow_ups', group: 'Prospects', label: 'Actions du jour et en retard', hint: 'Relances et rappels programmés', href: '/admin/crm/pipeline?assignee=me&queue=follow_ups_due', alert: true },
      prisma.lead.count({ where: queueWhere('follow_ups_due', me) }),
    );
  }
  if (scope.officeManager || scope.direction) {
    queue(
      { key: 'handed_over', group: 'Prospects', label: 'Dossiers transmis par la Sales Team', hint: 'Visite ou visio confirmée', href: '/admin/crm/pipeline?queue=handed_over' },
      prisma.lead.count({ where: scope.direction ? queueWhere('handed_over') : queueWhere('handed_over', me) }),
    );
    queue(
      { key: 'to_call', group: 'Ventes', label: 'Devis confirmés : paiement à organiser', hint: 'Appeler le client, envoyer la proforma', href: '/admin/crm/pipeline?queue=to_call', alert: true },
      prisma.lead.count({ where: scope.direction ? queueWhere('to_call') : queueWhere('to_call', me) }),
    );
  }
  if (scope.officeManager || scope.direction) {
    queue({ key: 'proofs', group: 'Ventes', label: 'Justificatifs de paiement à vérifier', hint: 'Valider active le membre', href: '/admin/factures?tab=justificatifs', alert: true }, prisma.paymentProof.count({ where: { status: 'PENDING' } }));
    queue({ key: 'proformas', group: 'Ventes', label: 'Proformas en attente de paiement', hint: 'Cash ou virement', href: '/admin/factures?status=SENT' }, prisma.invoice.count({ where: { status: 'SENT' } }));
  }
  if (scope.officeManager || scope.direction || isSupport) {
    queue(
      { key: 'to_deliver', group: 'Clients', label: isSupport ? 'Dossiers de création à traiter' : 'Services à livrer', hint: 'À lancer, en cours, ajustements', href: isSupport ? '/admin/lancements?pole=COMPANY_CREATION' : '/admin/lancements' },
      prisma.serviceOrder.count({ where: { AND: [ordersScope], status: { in: ['TO_START', 'IN_PROGRESS', 'ADJUSTMENT_REQUESTED'] }, ...(scope.direction || isSupport ? {} : { OR: [{ assignedToId: me }, { pole: { in: ['SPACES', 'IN_GROUP'] } }] }) } }),
    );
  }
  if (scope.officeManager || scope.direction) {
    queue({ key: 'events', group: 'Clients', label: 'Événements proposés à modérer', hint: 'Publier ou refuser', href: '/admin/evenements' }, prisma.event.count({ where: { status: 'PENDING_REVIEW' } }));
  }
  // Référent membre : n'importe quel compte peut l'être.
  queue(
    { key: 'awaiting_validation', group: 'Clients', label: 'Livrables en attente de validation', hint: 'Confirmer avec le membre', href: '/admin/lancements?status=AWAITING_VALIDATION' },
    prisma.serviceOrder.count({ where: { AND: [ordersScope], status: 'AWAITING_VALIDATION', ...(scope.direction || scope.officeManager ? {} : { user: { referentId: me } }) } }),
  );
  queue(
    { key: 'expiring', group: 'Clients', label: `Échéances à ${renewWindow} jours`, hint: 'Relancer le renouvellement', href: '/admin/lancements?vue=echeances' },
    prisma.serviceOrder.count({
      where: {
        AND: [ordersScope],
        status: 'DONE',
        renewedBy: null,
        expiredAt: null,
        expiresAt: { gte: now, lte: new Date(now.getTime() + renewWindow * DAY) },
        ...(scope.direction || scope.officeManager ? {} : { user: { referentId: me } }),
      },
    }),
  );

  const [queues, agenda, myMembers] = await Promise.all([
    Promise.all(tasks),
    hasCrm
      ? prisma.appointment.findMany({
          where: { assigneeId: me, status: 'SCHEDULED', startAt: { lt: dayEnd } },
          include: { lead: { select: { id: true, reference: true, title: true, contactName: true } } },
          orderBy: { startAt: 'asc' },
          take: 12,
        })
      : Promise.resolve([]),
    prisma.user.count({ where: { referentId: me, role: 'MEMBER' } }),
  ]);

  return {
    role: scope.role,
    roleLabel: isStaffRole(scope.role) ? ROLE_LABELS[scope.role] : scope.role,
    queues: (queues.filter(Boolean) as HomeQueue[]).filter((q) => q.count > 0 || ['to_dispatch', 'my_leads', 'to_deliver'].includes(q.key)),
    agenda: agenda.map((a) => ({ ...a, overdue: a.startAt < dayStart })),
    myMembers,
    kpis: scope.direction || scope.salesManager ? await getPilotage(scope) : null,
  };
}

// --- Indicateurs de pilotage (objectifs du processus v1.3) --------------------------------

export async function getPilotage(scope: StaffScope) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const scoped = scope.direction ? undefined : leadScopeWhere(scope);

  const [leadsThisMonth, visited, visitedWon, activeMembersNow, activeAtLastMonth, renewed, expired, extensions, deskCapacity, activeSubs] = await Promise.all([
    prisma.lead.count({ where: and(scoped, { createdAt: { gte: monthStart }, kind: 'NEW_BUSINESS' }) }),
    prisma.lead.findMany({
      where: and(scoped, { kind: 'NEW_BUSINESS', appointments: { some: { type: { in: ['VISIT', 'VIDEO', 'TRIAL_DAY'] }, startAt: { gte: ninetyDaysAgo } } } }),
      select: { id: true },
    }),
    prisma.lead.count({
      where: and(scoped, { kind: 'NEW_BUSINESS', stage: 'PAID', appointments: { some: { type: { in: ['VISIT', 'VIDEO', 'TRIAL_DAY'] }, startAt: { gte: ninetyDaysAgo } } } }),
    }),
    prisma.user.count({ where: { role: 'MEMBER', memberServiceOrders: { some: { status: 'DONE', OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } } } }),
    prisma.user.findMany({
      where: { role: 'MEMBER', memberServiceOrders: { some: { status: 'DONE', startsAt: { lte: lastMonthStart }, OR: [{ expiresAt: null }, { expiresAt: { gte: lastMonthStart } }] } } },
      select: { id: true },
    }),
    prisma.serviceOrder.count({ where: { renewedFromId: { not: null }, createdAt: { gte: ninetyDaysAgo } } }),
    prisma.serviceOrder.count({ where: { status: 'DONE', renewedBy: null, expiresAt: { gte: ninetyDaysAgo, lt: now } } }),
    prisma.lead.count({ where: { kind: 'EXTENSION', createdAt: { gte: ninetyDaysAgo } } }),
    prisma.spaceResource.aggregate({ where: { type: 'DESK', isActive: true }, _sum: { capacity: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } } }),
  ]);
  const retained = activeAtLastMonth.length
    ? await prisma.user.count({
        where: { id: { in: activeAtLastMonth.map((u) => u.id) }, memberServiceOrders: { some: { status: 'DONE', OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } } },
      })
    : 0;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
  const capacity = deskCapacity._sum.capacity ?? 0;

  return [
    { key: 'leads', label: 'Leads entrants ce mois', value: leadsThisMonth, unit: '', target: '> 25', status: leadsThisMonth > 25 ? 'good' : 'watch' },
    { key: 'conversion', label: 'Conversion visite → client (90 j)', value: pct(visitedWon, visited.length), unit: '%', target: '> 40 %', status: (pct(visitedWon, visited.length) ?? 0) > 40 ? 'good' : 'watch', detail: `${visitedWon} sur ${visited.length} visites` },
    { key: 'retention', label: 'Rétention mensuelle', value: pct(retained, activeAtLastMonth.length), unit: '%', target: '> 75 %', status: (pct(retained, activeAtLastMonth.length) ?? 0) > 75 ? 'good' : 'watch', detail: `${activeMembersNow} membres actifs` },
    { key: 'occupancy', label: 'Occupation du coworking', value: pct(activeSubs, capacity), unit: '%', target: '> 65 %', status: (pct(activeSubs, capacity) ?? 0) > 65 ? 'good' : 'watch', detail: capacity ? `${activeSubs} abonnements actifs / ${capacity} postes` : 'Renseignez la capacité des postes' },
    { key: 'renewal', label: 'Renouvellement à l’échéance (90 j)', value: pct(renewed, renewed + expired), unit: '%', target: 'À définir', status: 'info', detail: `${renewed} renouvelés, ${expired} expirés` },
    { key: 'extensions', label: 'Services supplémentaires / membre actif (90 j)', value: activeMembersNow ? Math.round((extensions / activeMembersNow) * 100) / 100 : null, unit: '', target: 'À définir', status: 'info', detail: `${extensions} demandes` },
    { key: 'nps', label: 'NPS membres', value: null, unit: '', target: '> 7 / 10', status: 'info', detail: 'Méthode de mesure à valider' },
  ];
}

// --- Tableau commercial ----------------------------------------------------------------

export async function getCrmDashboard(scope?: StaffScope) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in7Days = new Date(now.getTime() + 7 * DAY);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + DAY);
  const scoped = leadScopeWhere(scope);
  const leadWhere = scoped ?? {};
  const viaLead = scoped ? { lead: scoped } : {};

  const [byStage, byPipeline, byCircuit, openByAssignee, overdueActions, todayAppointments, weekAppointments, pendingQuotes, receivable, paidInvoices, leadsCreated, ninetyDay, toLaunch, staff] =
    await Promise.all([
      prisma.lead.groupBy({ by: ['stage'], where: leadWhere, _count: { _all: true }, _sum: { expectedAmount: true } }),
      prisma.lead.groupBy({ by: ['pipeline'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['circuit'], where: { ...leadWhere, stage: { in: OPEN_STAGES } }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['assignedToId'], where: { ...leadWhere, stage: { in: OPEN_STAGES } }, _count: { _all: true } }),
      prisma.lead.count({ where: { ...leadWhere, stage: { in: OPEN_STAGES }, nextActionAt: { lt: now } } }),
      prisma.appointment.count({ where: { ...viaLead, status: 'SCHEDULED', startAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.appointment.count({ where: { ...viaLead, status: 'SCHEDULED', startAt: { gte: now, lt: in7Days } } }),
      prisma.quote.aggregate({ where: { ...viaLead, status: 'SENT' }, _count: { _all: true }, _sum: { total: true } }),
      prisma.invoice.findMany({ where: { ...viaLead, status: 'SENT' }, select: { total: true, dueDate: true } }),
      prisma.invoice.findMany({ where: { ...viaLead, status: 'PAID', paidAt: { gte: sixMonthsAgo } }, select: { total: true, paidAt: true } }),
      prisma.lead.findMany({ where: { ...leadWhere, createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.lead.groupBy({
        by: ['stage'],
        where: { ...leadWhere, stage: { in: ['PAID', 'LOST'] }, updatedAt: { gte: new Date(now.getTime() - 90 * DAY) } },
        _count: { _all: true },
      }),
      prisma.serviceOrder.count({ where: { status: 'TO_START', ...orderScopeWhere(scope) } }),
      prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT'] } }, select: STAFF_SELECT }),
    ]);

  const stageMap = new Map(byStage.map((row) => [row.stage, row]));
  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    label: stageLabel(stage, null),
    count: stageMap.get(stage)?._count._all ?? 0,
    amount: Number(stageMap.get(stage)?._sum.expectedAmount ?? 0),
  }));
  const openLeads = stages.filter((s) => OPEN_STAGES.includes(s.stage));
  const won90 = ninetyDay.find((row) => row.stage === 'PAID')?._count._all ?? 0;
  const lost90 = ninetyDay.find((row) => row.stage === 'LOST')?._count._all ?? 0;

  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const series = months.map((date) => ({
    month: date.toLocaleDateString('fr-FR', { month: 'short' }),
    leads: leadsCreated.filter((l) => monthKey(l.createdAt) === monthKey(date)).length,
    revenue: paidInvoices.filter((inv) => inv.paidAt && monthKey(inv.paidAt) === monthKey(date)).reduce((sum, inv) => sum + Number(inv.total), 0),
  }));

  const staffById = new Map(staff.map((u) => [u.id, u]));
  const overdueInvoices = receivable.filter((inv) => inv.dueDate && inv.dueDate < now);

  return {
    scope: !scope || scope.allLeads ? ('team' as const) : ('mine' as const),
    canManage: !scope || scope.manageLeads,
    kpis: {
      openLeads: openLeads.reduce((sum, s) => sum + s.count, 0),
      pipelineAmount: openLeads.reduce((sum, s) => sum + s.amount, 0),
      toDispatch: await prisma.lead.count({ where: and(scoped, queueWhere('to_dispatch')) }),
      toAssign: await prisma.lead.count({ where: and(scoped, queueWhere('to_assign')) }),
      wonThisMonth: paidInvoices.filter((inv) => inv.paidAt && inv.paidAt >= monthStart).length,
      revenueThisMonth: paidInvoices.filter((inv) => inv.paidAt && inv.paidAt >= monthStart).reduce((sum, inv) => sum + Number(inv.total), 0),
      conversionRate: won90 + lost90 > 0 ? Math.round((won90 / (won90 + lost90)) * 100) : null,
      overdueActions,
      appointmentsToday: todayAppointments,
      appointmentsWeek: weekAppointments,
      pendingQuotes: pendingQuotes._count._all,
      pendingQuotesAmount: Number(pendingQuotes._sum.total ?? 0),
      receivableAmount: receivable.reduce((sum, inv) => sum + Number(inv.total), 0),
      overdueInvoices: overdueInvoices.length,
      servicesToLaunch: toLaunch,
    },
    stages,
    pipelines: byPipeline.map((row) => ({ pipeline: row.pipeline, label: row.pipeline ? PIPELINE_LABEL[row.pipeline] : 'Non renseigné', count: row._count._all })),
    circuits: byCircuit.map((row) => ({ circuit: row.circuit, label: row.circuit ? CIRCUIT_LABEL[row.circuit] : 'À aiguiller', count: row._count._all })),
    assignees: openByAssignee.map((row) => ({
      id: row.assignedToId,
      name: row.assignedToId ? staffName(staffById.get(row.assignedToId) ?? { displayName: null, email: 'Compte supprimé' }) : 'Sans intervenant',
      count: row._count._all,
    })),
    series,
  };
}
