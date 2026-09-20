import type { Prisma, LeadSource, LeadStage, ActivityType, AppointmentType, AppointmentStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { requestLabel } from '../services/requestLabel';
import { nextNumber } from './numbering';
import { STAFF_SELECT, listStaffWith, notifyUsers, staffName } from './staff';

// Cœur du CRM : leads / opportunités (un même enregistrement qui avance dans
// le pipeline), journal d'activité, rendez-vous, tableau de bord.

export const STAGE_ORDER: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_SENT', 'WON', 'LOST'];
export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  QUALIFIED: 'Qualifié',
  QUOTE_SENT: 'Devis envoyé',
  WON: 'Gagné',
  LOST: 'Perdu',
};
const OPEN_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_SENT'];

const LEAD_LIST_INCLUDE = {
  assignedTo: { select: STAFF_SELECT },
  _count: { select: { activities: true, quotes: true, invoices: true } },
} satisfies Prisma.LeadInclude;

// --- Journal -----------------------------------------------------------------

export async function logActivity(
  leadId: string,
  input: { type?: ActivityType; content: string; authorId?: string | null; occurredAt?: Date },
) {
  return prisma.leadActivity.create({
    data: {
      leadId,
      type: input.type ?? 'SYSTEM',
      content: input.content,
      authorId: input.authorId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

// --- Leads -------------------------------------------------------------------

export interface LeadListFilter {
  stage?: LeadStage;
  /** null = leads non assignés ; undefined = pas de filtre. */
  assignedToId?: string | null;
  source?: LeadSource;
  search?: string;
}

/** Journal global (reporting quotidien des commerciaux). */
export async function listActivities(filter: { authorId?: string; type?: ActivityType; from?: Date; to?: Date; search?: string }) {
  const search = filter.search?.trim();
  return prisma.leadActivity.findMany({
    where: {
      authorId: filter.authorId,
      type: filter.type,
      occurredAt: { gte: filter.from, lte: filter.to },
      ...(search ? { OR: [{ content: { contains: search } }, { lead: { title: { contains: search } } }, { lead: { contactName: { contains: search } } }] } : {}),
    },
    include: {
      author: { select: STAFF_SELECT },
      lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: 300,
  });
}

export async function listLeads(filter: LeadListFilter) {
  const search = filter.search?.trim();
  return prisma.lead.findMany({
    where: {
      stage: filter.stage,
      assignedToId: filter.assignedToId,
      source: filter.source,
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { contactName: { contains: search } },
              { companyName: { contains: search } },
              { email: { contains: search } },
              { reference: { contains: search } },
            ],
          }
        : {}),
    },
    include: LEAD_LIST_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: STAFF_SELECT },
      // isPublic = compte validé par l'équipe (cf. situation/accountState.ts).
      user: { select: { id: true, email: true, profile: { select: { isPublic: true } } } },
      serviceRequest: { include: { items: { orderBy: { createdAt: 'asc' } } } },
      contactMessage: true,
      activities: { include: { author: { select: STAFF_SELECT } }, orderBy: { occurredAt: 'desc' } },
      appointments: { include: { assignee: { select: STAFF_SELECT } }, orderBy: { startAt: 'asc' } },
      quotes: { select: { id: true, number: true, status: true, total: true, validUntil: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      invoices: { select: { id: true, number: true, status: true, total: true, dueDate: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      serviceOrders: { select: { id: true, title: true, status: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  // Justificatifs de paiement envoyés par le membre rattaché à ce lead.
  const paymentProofs = lead.userId
    ? await prisma.paymentProof.findMany({
        where: { userId: lead.userId },
        select: { id: true, status: true, fileName: true, mimeType: true, amount: true, reference: true, note: true, reviewNote: true, createdAt: true, quote: { select: { number: true } }, invoice: { select: { id: true, number: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  return { ...lead, paymentProofs };
}

export interface LeadInput {
  title: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  source?: LeadSource;
  expectedAmount?: number | null;
  notes?: string | null;
  assignedToId?: string | null;
  nextActionAt?: Date | null;
  userId?: string | null;
}

/** Compte membre portant cette adresse email (pour rattacher un lead à son espace). */
async function memberIdForEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email, role: 'MEMBER' }, select: { id: true } });
  return user?.id ?? null;
}

export async function createLead(input: LeadInput, actorId: string) {
  const reference = await nextNumber('LD');
  const userId = input.userId ?? (await memberIdForEmail(input.email));
  const lead = await prisma.lead.create({
    data: {
      ...input,
      userId,
      reference,
      // Un commercial qui crée un lead se l'attribue par défaut.
      assignedToId: input.assignedToId === undefined ? actorId : input.assignedToId,
      source: input.source ?? 'OTHER',
    },
  });
  await logActivity(lead.id, { content: 'Lead créé manuellement.', authorId: actorId });
  return lead;
}

export async function updateLead(id: string, patch: Partial<LeadInput>, actorId: string) {
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound('Lead introuvable');

  // Une adresse email ajoutée ou corrigée peut désormais correspondre à un membre.
  const userId = patch.email !== undefined && !before.userId ? await memberIdForEmail(patch.email) : undefined;
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...patch,
      ...(userId ? { userId } : {}),
      // Reprogrammer l'action suivante réarme l'alerte automatique.
      ...(patch.nextActionAt !== undefined ? { nextActionAlertedAt: null } : {}),
    },
  });

  if (patch.assignedToId !== undefined && patch.assignedToId !== before.assignedToId) {
    const target = patch.assignedToId
      ? await prisma.user.findUnique({ where: { id: patch.assignedToId }, select: STAFF_SELECT })
      : null;
    await logActivity(id, {
      content: target ? `Lead assigné à ${staffName(target)}.` : 'Lead désassigné.',
      authorId: actorId,
    });
    if (target && target.id !== actorId) {
      await notifyUsers([target.id], 'lead_assigned', 'Lead assigné', `${lead.reference} — ${lead.title} vous a été confié.`);
    }
  }
  return lead;
}

export async function changeStage(id: string, stage: LeadStage, actorId: string, lostReason?: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  if (lead.stage === stage) return lead;
  if (stage === 'LOST' && !lostReason?.trim()) {
    throw ApiError.badRequest('Indiquez le motif de perte pour clôturer ce lead.');
  }

  const now = new Date();
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      stage,
      wonAt: stage === 'WON' ? now : null,
      lostAt: stage === 'LOST' ? now : null,
      lostReason: stage === 'LOST' ? lostReason!.trim() : null,
    },
  });
  await logActivity(id, {
    content: `Étape : ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[stage]}${stage === 'LOST' ? ` (motif : ${lostReason!.trim()})` : ''}.`,
    authorId: actorId,
  });
  return updated;
}

/** Fait avancer un lead sans jamais le faire reculer ni rouvrir un lead clos. */
export async function advanceStageTo(id: string, stage: LeadStage, actorId?: string | null) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.stage === 'WON' || lead.stage === 'LOST') return;
  if (STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(lead.stage)) return;
  await prisma.lead.update({
    where: { id },
    data: { stage, wonAt: stage === 'WON' ? new Date() : undefined },
  });
  await logActivity(id, { content: `Étape : ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[stage]}.`, authorId: actorId });
}

export async function addActivity(
  leadId: string,
  input: { type: ActivityType; content: string; occurredAt?: Date; mentionIds?: string[] },
  authorId: string,
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');

  const activity = await logActivity(leadId, { ...input, authorId });
  // Toute activité « touche » la fiche : elle sort de la liste des dormants.
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date(), dormantAlertedAt: null } });

  const mentions = (input.mentionIds ?? []).filter((id) => id !== authorId);
  if (mentions.length) {
    await notifyUsers(mentions, 'lead_mention', 'Vous êtes mentionné', `${lead.reference} — ${lead.title} : ${input.content.slice(0, 140)}`);
  }
  return activity;
}

// --- Rendez-vous -------------------------------------------------------------

export async function listAppointments(filter: { from: Date; to: Date; assigneeId?: string }) {
  return prisma.appointment.findMany({
    where: { startAt: { gte: filter.from, lt: filter.to }, assigneeId: filter.assigneeId },
    include: {
      lead: { select: { id: true, reference: true, title: true, contactName: true, companyName: true } },
      assignee: { select: STAFF_SELECT },
    },
    orderBy: { startAt: 'asc' },
  });
}

export interface AppointmentInput {
  type: AppointmentType;
  startAt: Date;
  endAt?: Date | null;
  location?: string | null;
  notes?: string | null;
  assigneeId?: string | null;
}

export async function createAppointment(leadId: string, input: AppointmentInput, actorId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  const appointment = await prisma.appointment.create({
    data: { ...input, leadId, assigneeId: input.assigneeId === undefined ? actorId : input.assigneeId },
  });
  await logActivity(leadId, {
    content: `Rendez-vous programmé le ${input.startAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}.`,
    authorId: actorId,
  });
  await advanceStageTo(leadId, 'CONTACTED', actorId);
  return appointment;
}

export async function updateAppointment(
  id: string,
  patch: Partial<AppointmentInput> & { status?: AppointmentStatus },
  actorId: string,
) {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Rendez-vous introuvable');
  const updated = await prisma.appointment.update({
    where: { id },
    data: { ...patch, ...(patch.startAt ? { reminderSentAt: null } : {}) },
  });
  if (patch.status && patch.status !== existing.status) {
    const label = patch.status === 'DONE' ? 'effectué' : patch.status === 'CANCELLED' ? 'annulé' : 'reprogrammé';
    await logActivity(existing.leadId, { content: `Rendez-vous ${label}.`, authorId: actorId });
  }
  return updated;
}

export async function deleteAppointment(id: string) {
  await prisma.appointment.delete({ where: { id } }).catch(() => {
    throw ApiError.notFound('Rendez-vous introuvable');
  });
}

// --- Entrées automatiques ------------------------------------------------------

/** Demande de devis du site (panier) → lead « Nouveau », prérempli depuis le compte. */
export async function createLeadFromServiceRequest(requestId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      items: true,
      user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true, companyName: true } } } },
    },
  });
  if (!request || request.items.length === 0) return null;

  const priced = request.items.reduce((sum, item) => sum + (item.unitPrice ? Number(item.unitPrice) : 0), 0);
  const profile = request.user?.profile;
  const contactName =
    (profile && `${profile.firstName} ${profile.lastName}`.trim()) || request.user?.email || request.guestName || 'Contact du site';

  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: requestLabel(request.items),
      contactName,
      email: request.user?.email ?? request.guestEmail,
      phone: request.user?.phone ?? request.guestPhone,
      companyName: profile?.companyName ?? request.guestCompany,
      source: 'WEBSITE_QUOTE',
      expectedAmount: priced > 0 ? priced : null,
      notes: request.notes,
      userId: request.userId,
      serviceRequestId: request.id,
    },
  });
  await logActivity(lead.id, {
    content: `Lead créé automatiquement depuis la demande de devis du site (${request.items.length} ligne${request.items.length > 1 ? 's' : ''}).`,
  });

  const recipients = await listStaffWith('crm');
  await notifyUsers(
    recipients.map((u) => u.id),
    'lead_new',
    'Nouveau lead',
    `${lead.reference} — ${lead.title} (${contactName}) vient d'arriver depuis le site.`,
  );
  return lead;
}

/**
 * Nouvelle inscription (« Devenir membre ») → lead « Inscription » pour l'équipe,
 * et rattachement des leads déjà ouverts avec la même adresse email.
 */
export async function createLeadFromRegistration(userId: string) {
  const existing = await prisma.lead.findFirst({ where: { userId, source: 'REGISTRATION' } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, company: { select: { name: true, seatLimit: true } } },
  });
  if (!user) return null;

  const contactName = user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : user.email;
  const companyName = user.company?.name ?? user.profile?.companyName ?? null;
  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: user.company ? `Inscription entreprise — ${user.company.name}` : `Inscription — ${contactName}`,
      contactName,
      email: user.email,
      phone: user.phone,
      companyName,
      source: 'REGISTRATION',
      notes: user.company ? `Compte entreprise : ${user.company.seatLimit} poste(s) demandé(s).` : null,
      userId,
    },
  });
  await logActivity(lead.id, { content: 'Lead créé automatiquement à l\'inscription : compte en attente de validation.' });
  await prisma.lead.updateMany({ where: { email: user.email, userId: null }, data: { userId } });

  const recipients = await listStaffWith('crm');
  await notifyUsers(
    recipients.map((u) => u.id),
    'lead_new',
    'Nouvelle inscription',
    `${lead.reference} — ${contactName}${companyName ? ` (${companyName})` : ''} vient de créer un compte, à valider.`,
  );
  return lead;
}

/** Formulaire /contact → lead « Nouveau ». */
export async function createLeadFromContactMessage(messageId: string) {
  const message = await prisma.contactMessage.findUnique({ where: { id: messageId } });
  if (!message) return null;
  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: `Message de contact — ${message.name}`,
      contactName: message.name,
      email: message.email,
      source: 'CONTACT_FORM',
      notes: message.message,
      contactMessageId: message.id,
    },
  });
  await logActivity(lead.id, { content: 'Lead créé automatiquement depuis le formulaire de contact.' });
  const recipients = await listStaffWith('crm');
  await notifyUsers(
    recipients.map((u) => u.id),
    'lead_new',
    'Nouveau lead',
    `${lead.reference} — message de ${message.name} reçu via le formulaire de contact.`,
  );
  return lead;
}

// --- Tableau de bord ------------------------------------------------------------

export async function getDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  const [byStage, bySource, openByAssignee, overdueActions, todayAppointments, weekAppointments, pendingQuotes, receivable, paidInvoices, leadsCreated, ninetyDay, toLaunch, staff] =
    await Promise.all([
      prisma.lead.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { expectedAmount: true } }),
      prisma.lead.groupBy({ by: ['source'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['assignedToId'], where: { stage: { in: OPEN_STAGES } }, _count: { _all: true } }),
      prisma.lead.count({ where: { stage: { in: OPEN_STAGES }, nextActionAt: { lt: now } } }),
      prisma.appointment.count({ where: { status: 'SCHEDULED', startAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.appointment.count({ where: { status: 'SCHEDULED', startAt: { gte: now, lt: in7Days } } }),
      prisma.quote.aggregate({ where: { status: 'SENT' }, _count: { _all: true }, _sum: { total: true } }),
      prisma.invoice.findMany({ where: { status: 'SENT' }, select: { total: true, dueDate: true } }),
      prisma.invoice.findMany({ where: { status: 'PAID', paidAt: { gte: sixMonthsAgo } }, select: { total: true, paidAt: true } }),
      prisma.lead.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.lead.groupBy({
        by: ['stage'],
        where: { stage: { in: ['WON', 'LOST'] }, updatedAt: { gte: new Date(now.getTime() - 90 * 24 * 3600 * 1000) } },
        _count: { _all: true },
      }),
      prisma.serviceOrder.count({ where: { status: 'TO_START' } }),
      prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER'] } }, select: STAFF_SELECT }),
    ]);

  const stageMap = new Map(byStage.map((row) => [row.stage, row]));
  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    count: stageMap.get(stage)?._count._all ?? 0,
    amount: Number(stageMap.get(stage)?._sum.expectedAmount ?? 0),
  }));
  const openLeads = stages.filter((s) => OPEN_STAGES.includes(s.stage));
  const won90 = ninetyDay.find((row) => row.stage === 'WON')?._count._all ?? 0;
  const lost90 = ninetyDay.find((row) => row.stage === 'LOST')?._count._all ?? 0;

  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const series = months.map((date) => ({
    month: date.toLocaleDateString('fr-FR', { month: 'short' }),
    leads: leadsCreated.filter((l) => monthKey(l.createdAt) === monthKey(date)).length,
    revenue: paidInvoices
      .filter((inv) => inv.paidAt && monthKey(inv.paidAt) === monthKey(date))
      .reduce((sum, inv) => sum + Number(inv.total), 0),
  }));

  const staffById = new Map(staff.map((u) => [u.id, u]));
  const overdueInvoices = receivable.filter((inv) => inv.dueDate && inv.dueDate < now);

  return {
    kpis: {
      openLeads: openLeads.reduce((sum, s) => sum + s.count, 0),
      pipelineAmount: openLeads.reduce((sum, s) => sum + s.amount, 0),
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
    sources: bySource.map((row) => ({ source: row.source, count: row._count._all })),
    assignees: openByAssignee.map((row) => ({
      id: row.assignedToId,
      name: row.assignedToId ? staffName(staffById.get(row.assignedToId) ?? { displayName: null, email: 'Compte supprimé' }) : 'Non assignés',
      count: row._count._all,
    })),
    series,
  };
}

// --- Recherche globale (Ctrl+K) ---------------------------------------------------

export async function globalSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return { leads: [], quotes: [], invoices: [] };
  const [leads, quotes, invoices] = await Promise.all([
    prisma.lead.findMany({
      where: { OR: [{ reference: { contains: q } }, { title: { contains: q } }, { contactName: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, reference: true, title: true, contactName: true, stage: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    prisma.quote.findMany({
      where: { OR: [{ number: { contains: q } }, { lead: { contactName: { contains: q } } }, { lead: { companyName: { contains: q } } }] },
      select: { id: true, number: true, status: true, total: true, lead: { select: { contactName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { OR: [{ number: { contains: q } }, { customerName: { contains: q } }, { customerCompany: { contains: q } }] },
      select: { id: true, number: true, status: true, total: true, customerName: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  return { leads, quotes, invoices };
}
