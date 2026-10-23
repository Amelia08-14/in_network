import type { CommissionBeneficiary, CommissionMode, CommissionStatus, LeadCircuit, LeadKind, Prisma, ServiceCategory } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { logActivity } from './leads.service';
import { netLineAmounts, round2 } from './money';
import type { StaffScope } from './scope';
import { STAFF_SELECT, notifyUsers } from './staff';

// Mécanisme de commission (phase 8 du processus v1.3).
// Le fait générateur est le paiement encaissé : à l'enregistrement du paiement,
// une ligne de commission est calculée par ligne de facture et par bénéficiaire
// — le commercial closer (circuit 1) et l'Office Manager (circuits 1 et 2) —
// selon le barème saisi par IN NETWORK (aucune règle = aucune commission).
// Elle devient éligible quand le service est livré et validé par le membre,
// puis est contrôlée par le responsable commercial (circuit 1), validée par la
// Direction et versée. Un remboursement la reprend.

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: 'Calculée (service en cours de livraison)',
  ELIGIBLE: 'Éligible',
  CHECKED: 'Contrôlée',
  VALIDATED: 'Validée',
  PAID: 'Versée',
  CANCELLED: 'Reprise',
};

const RULE_INCLUDE = {
  service: { select: { id: true, title: true } },
  plan: { select: { id: true, name: true } },
} satisfies Prisma.CommissionRuleInclude;

// --- Barème --------------------------------------------------------------------

export interface RuleInput {
  beneficiary: CommissionBeneficiary;
  serviceId?: string | null;
  planId?: string | null;
  category?: ServiceCategory | null;
  leadKind?: LeadKind | null;
  circuit?: LeadCircuit | null;
  mode: CommissionMode;
  value: number;
  isActive?: boolean;
}

export const listRules = () => prisma.commissionRule.findMany({ include: RULE_INCLUDE, orderBy: [{ beneficiary: 'asc' }, { createdAt: 'asc' }] });

function assertRule(input: Partial<RuleInput>) {
  if (input.mode === 'RATE' && input.value !== undefined && input.value > 100) throw ApiError.badRequest('Un taux ne dépasse pas 100 %.');
  if (input.serviceId && input.planId) throw ApiError.badRequest('Une règle porte sur un service ou sur une formule, pas les deux.');
}

export async function createRule(input: RuleInput) {
  assertRule(input);
  return prisma.commissionRule.create({ data: input, include: RULE_INCLUDE });
}

export async function updateRule(id: string, input: Partial<RuleInput>) {
  assertRule(input);
  return prisma.commissionRule.update({ where: { id }, data: input, include: RULE_INCLUDE });
}

export const deleteRule = (id: string) => prisma.commissionRule.delete({ where: { id } });

type Rule = Awaited<ReturnType<typeof prisma.commissionRule.findMany>>[number];

/** La règle la plus précise l'emporte : service / formule, puis catégorie, puis règle générale. */
function pickRule(
  rules: Rule[],
  ctx: { beneficiary: CommissionBeneficiary; serviceId: string | null; planId: string | null; category: ServiceCategory | null; kind: LeadKind; circuit: LeadCircuit | null },
) {
  const candidates = rules.filter(
    (r) =>
      r.isActive &&
      r.beneficiary === ctx.beneficiary &&
      (!r.leadKind || r.leadKind === ctx.kind) &&
      (!r.circuit || r.circuit === ctx.circuit) &&
      (!r.serviceId || r.serviceId === ctx.serviceId) &&
      (!r.planId || r.planId === ctx.planId) &&
      (!r.category || r.category === ctx.category),
  );
  const score = (r: Rule) => (r.serviceId || r.planId ? 4 : 0) + (r.category ? 2 : 0) + (r.leadKind ? 1 : 0) + (r.circuit ? 1 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

// --- Calcul au paiement -----------------------------------------------------------

/** Idempotent : une ligne de facture ne génère qu'une commission par rôle. */
export async function createCommissionsForInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: true,
      serviceOrders: { select: { id: true, invoiceLineId: true, status: true } },
      lead: { select: { id: true, kind: true, circuit: true, salesAgentId: true, assignedToId: true, assignedTo: { select: { role: true } } } },
    },
  });
  if (!invoice?.lead || invoice.status !== 'PAID') return [];
  const lead = invoice.lead;

  const beneficiaries: { role: CommissionBeneficiary; userId: string }[] = [];
  if (lead.circuit === 'SALES_TEAM' && lead.salesAgentId) beneficiaries.push({ role: 'CLOSER', userId: lead.salesAgentId });
  if (lead.assignedToId && lead.assignedTo?.role === 'OFFICE_MANAGER') beneficiaries.push({ role: 'OFFICE_MANAGER', userId: lead.assignedToId });
  if (beneficiaries.length === 0) return [];

  const rules = await prisma.commissionRule.findMany({ where: { isActive: true } });
  if (rules.length === 0) return [];
  const serviceIds = invoice.lines.map((l) => l.serviceId).filter((id): id is string => Boolean(id));
  const services = serviceIds.length ? await prisma.serviceCatalogItem.findMany({ where: { id: { in: serviceIds } }, select: { id: true, category: true } }) : [];

  // Base : montant HT net de la ligne, remises (ligne et total) déduites.
  const nets = netLineAmounts(
    invoice.lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountRate: Number(l.discountRate) })),
    { type: invoice.discountType, value: Number(invoice.discountValue) },
  );
  const created: string[] = [];
  for (const [index, line] of invoice.lines.entries()) {
    const base = nets[index];
    if (base <= 0) continue;
    const order = invoice.serviceOrders.find((o) => o.invoiceLineId === line.id);
    for (const beneficiary of beneficiaries) {
      const rule = pickRule(rules, {
        beneficiary: beneficiary.role,
        serviceId: line.serviceId,
        planId: line.planId,
        category: services.find((s) => s.id === line.serviceId)?.category ?? null,
        kind: lead.kind,
        circuit: lead.circuit,
      });
      if (!rule) continue;
      const amount = rule.mode === 'RATE' ? round2((base * Number(rule.value)) / 100) : round2(Number(rule.value) * Number(line.quantity));
      const existing = await prisma.commission.findUnique({ where: { invoiceLineId_role: { invoiceLineId: line.id, role: beneficiary.role } } });
      if (existing) continue;
      const commission = await prisma.commission.create({
        data: {
          leadId: lead.id,
          invoiceId: invoice.id,
          invoiceLineId: line.id,
          orderId: order?.id ?? null,
          beneficiaryId: beneficiary.userId,
          role: beneficiary.role,
          ruleId: rule.id,
          description: line.description.slice(0, 190),
          baseAmount: base,
          amount,
          // Un service déjà livré (renouvellement) rend la commission éligible tout de suite.
          status: order?.status === 'DONE' ? 'ELIGIBLE' : 'PENDING',
        },
      });
      created.push(commission.id);
    }
  }
  if (created.length) await logActivity(lead.id, { content: `${created.length} ligne${created.length > 1 ? 's' : ''} de commission calculée${created.length > 1 ? 's' : ''} (paiement encaissé).` });
  return created;
}

/** Service livré et validé : ses commissions deviennent éligibles. */
export async function markCommissionsEligible(orderId: string) {
  await prisma.commission.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'ELIGIBLE' } });
}

/** Remboursement : les commissions de la facture sont reprises, même déjà versées (à déduire du prochain relevé). */
export async function cancelCommissionsForInvoice(invoiceId: string, reason: string) {
  const affected = await prisma.commission.findMany({ where: { invoiceId, status: { not: 'CANCELLED' } }, select: { id: true, beneficiaryId: true, status: true } });
  if (affected.length === 0) return 0;
  await prisma.commission.updateMany({
    where: { id: { in: affected.map((c) => c.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date(), note: `Reprise : ${reason}` },
  });
  const paid = affected.filter((c) => c.status === 'PAID');
  await notifyUsers([...new Set(paid.map((c) => c.beneficiaryId))], 'commission_cancelled', 'Commission reprise', `Une commission déjà versée est reprise suite à un remboursement (${reason}).`);
  return affected.length;
}

// --- Contrôle, validation, versement --------------------------------------------------

const COMMISSION_INCLUDE = {
  beneficiary: { select: STAFF_SELECT },
  lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true, circuit: true } },
  invoice: { select: { id: true, number: true, paidAt: true } },
  order: { select: { id: true, title: true, status: true } },
} satisfies Prisma.CommissionInclude;

export async function listCommissions(filter: { status?: CommissionStatus; beneficiaryId?: string; month?: string }, scope?: StaffScope) {
  // Un commercial ou un Office Manager ne voit que les siennes ; le responsable
  // commercial celles du circuit 1 ; la Direction tout.
  const own = scope && !scope.direction && !scope.salesManager;
  const range = filter.month ? monthRange(filter.month) : null;
  return prisma.commission.findMany({
    where: {
      status: filter.status,
      beneficiaryId: own ? scope!.userId : filter.beneficiaryId,
      ...(scope?.salesManager && !scope.direction ? { lead: { circuit: 'SALES_TEAM' } } : {}),
      ...(range ? { invoice: { paidAt: { gte: range.from, lt: range.to } } } : {}),
    },
    include: COMMISSION_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
}

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) throw ApiError.badRequest('Mois invalide (AAAA-MM).');
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

/** Contrôle du responsable commercial (circuit 1) : dossier complet, paiement vérifié, source tracée. */
export async function checkCommissions(ids: string[], actorId: string, scope?: StaffScope) {
  if (scope && !scope.salesManager && !scope.direction) throw ApiError.forbidden('Le contrôle revient au responsable commercial.');
  const rows = await prisma.commission.findMany({ where: { id: { in: ids } }, include: { lead: { select: { circuit: true } } } });
  const eligible = rows.filter((c) => c.status === 'ELIGIBLE' && c.lead?.circuit === 'SALES_TEAM');
  if (eligible.length === 0) throw ApiError.conflict('Aucune commission éligible du circuit 1 dans cette sélection.');
  await prisma.commission.updateMany({ where: { id: { in: eligible.map((c) => c.id) } }, data: { status: 'CHECKED', checkedAt: new Date(), checkedById: actorId } });
  return eligible.length;
}

/** Validation de la Direction : contrôlées (circuit 1) ou éligibles (circuit 2). */
export async function validateCommissions(ids: string[], actorId: string, scope?: StaffScope) {
  if (scope && !scope.direction) throw ApiError.forbidden('La validation des commissions revient à la Direction.');
  const rows = await prisma.commission.findMany({ where: { id: { in: ids } }, include: { lead: { select: { circuit: true } } } });
  const ready = rows.filter((c) => c.status === 'CHECKED' || (c.status === 'ELIGIBLE' && c.lead?.circuit !== 'SALES_TEAM'));
  if (ready.length === 0) throw ApiError.conflict('Aucune commission prête à valider dans cette sélection (le circuit 1 passe d’abord par le contrôle du responsable commercial).');
  await prisma.commission.updateMany({ where: { id: { in: ready.map((c) => c.id) } }, data: { status: 'VALIDATED', validatedAt: new Date(), validatedById: actorId } });
  return ready.length;
}

/** Versement périodique : les commissions validées passent « Versée ». */
export async function payCommissions(ids: string[], scope?: StaffScope) {
  if (scope && !scope.direction) throw ApiError.forbidden('Le versement des commissions revient à la Direction.');
  const ready = await prisma.commission.findMany({ where: { id: { in: ids }, status: 'VALIDATED' }, select: { id: true, beneficiaryId: true, amount: true } });
  if (ready.length === 0) throw ApiError.conflict('Aucune commission validée dans cette sélection.');
  await prisma.commission.updateMany({ where: { id: { in: ready.map((c) => c.id) } }, data: { status: 'PAID', paidAt: new Date() } });
  const byBeneficiary = new Map<string, number>();
  for (const c of ready) byBeneficiary.set(c.beneficiaryId, (byBeneficiary.get(c.beneficiaryId) ?? 0) + Number(c.amount));
  for (const [userId, total] of byBeneficiary) {
    await notifyUsers([userId], 'commission_paid', 'Commissions versées', `${total.toLocaleString('fr-FR')} DA de commissions ont été versées.`, '/admin/commissions');
  }
  return ready.length;
}

/** Relevé mensuel détaillé par bénéficiaire et par client. */
export async function monthlyStatement(month: string, scope?: StaffScope) {
  const rows = await listCommissions({ month }, scope);
  const byBeneficiary = new Map<string, { beneficiary: (typeof rows)[number]['beneficiary']; total: number; validated: number; paid: number; lines: typeof rows }>();
  for (const row of rows) {
    if (row.status === 'CANCELLED' && !row.paidAt) continue;
    const entry = byBeneficiary.get(row.beneficiaryId) ?? { beneficiary: row.beneficiary, total: 0, validated: 0, paid: 0, lines: [] };
    const signed = row.status === 'CANCELLED' ? -Number(row.amount) : Number(row.amount);
    entry.total += signed;
    if (row.status === 'VALIDATED') entry.validated += signed;
    if (row.status === 'PAID') entry.paid += signed;
    entry.lines.push(row);
    byBeneficiary.set(row.beneficiaryId, entry);
  }
  return { month, beneficiaries: [...byBeneficiary.values()].map((e) => ({ ...e, total: round2(e.total), validated: round2(e.validated), paid: round2(e.paid) })) };
}
