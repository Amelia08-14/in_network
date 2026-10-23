import type {
  ActivityType,
  AppointmentStatus,
  AppointmentType,
  LeadChannel,
  LeadCircuit,
  LeadKind,
  LeadPipeline,
  LeadPriority,
  LeadSource,
  LeadStage,
  Prisma,
} from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { getSettings } from '../settings/settings.service';
import { nextNumber } from './numbering';
import { assertLeadAccess, leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, listStaffByRole, listStaffWith, notifyUsers, staffName } from './staff';
import { CHANNEL_PIPELINE, OPEN_STAGES, STAGE_LABEL, STAGE_ORDER, stageLabel } from './workflow';

// Fiche lead unique (processus v1.3) : création, consultation, journal,
// rendez-vous, recherche. Le parcours (aiguillage, attribution, qualification,
// relance, visite, passerelle) est dans leadFlow.service.ts ; les leads créés
// par le site et l'espace membre dans leadIntake.service.ts.

export const PRIORITY_LABEL: Record<LeadPriority, string> = { COLD: 'Froid', WARM: 'Tiède', HOT: 'Chaud' };

export const LEAD_LIST_INCLUDE = {
  assignedTo: { select: STAFF_SELECT },
  salesAgent: { select: STAFF_SELECT },
  // Compte membre rattaché (isPublic = espace déverrouillé).
  user: { select: { id: true, profile: { select: { isPublic: true } } } },
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

/** Journal global (reporting quotidien de l'équipe). */
export async function listActivities(
  filter: { authorId?: string; type?: ActivityType; from?: Date; to?: Date; search?: string },
  scope?: StaffScope,
) {
  const search = filter.search?.trim();
  const scoped = leadScopeWhere(scope);
  return prisma.leadActivity.findMany({
    where: {
      authorId: filter.authorId,
      type: filter.type,
      occurredAt: { gte: filter.from, lte: filter.to },
      ...(scoped ? { lead: scoped } : {}),
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

// --- Leads -------------------------------------------------------------------

/** Files de travail prêtes à l'emploi (page « À aiguiller », « Ma journée »). */
export type LeadQueue = 'to_dispatch' | 'to_assign' | 'returned' | 'handed_over' | 'to_call' | 'follow_ups_due';

export interface LeadListFilter {
  stage?: LeadStage;
  /** 'none' = leads à aiguiller (sans circuit). */
  circuit?: LeadCircuit | 'none';
  pipeline?: LeadPipeline;
  kind?: LeadKind;
  source?: LeadSource;
  /** null = sans intervenant ; undefined = pas de filtre. */
  assignedToId?: string | null;
  queue?: LeadQueue;
  search?: string;
}

export function queueWhere(queue: LeadQueue, userId?: string): Prisma.LeadWhereInput {
  const now = new Date();
  switch (queue) {
    case 'to_dispatch':
      return { circuit: null, stage: { in: OPEN_STAGES } };
    case 'to_assign':
      return { circuit: 'SALES_TEAM', stage: 'REGISTERED', salesAgentId: null };
    case 'returned':
      return { followUpReturnedAt: { not: null }, stage: { in: OPEN_STAGES } };
    case 'handed_over':
      return { handedOverAt: { not: null }, stage: { in: ['VISIT_CONFIRMED', 'QUOTE_SENT'] }, ...(userId ? { assignedToId: userId } : {}) };
    case 'to_call':
      return { stage: 'CONFIRMED', ...(userId ? { assignedToId: userId } : {}) };
    case 'follow_ups_due':
      return { stage: { in: OPEN_STAGES }, nextActionAt: { lte: now }, ...(userId ? { assignedToId: userId } : {}) };
  }
}

export async function listLeads(filter: LeadListFilter, scope?: StaffScope) {
  const search = filter.search?.trim();
  const scoped = leadScopeWhere(scope);
  const where: Prisma.LeadWhereInput[] = [];
  if (scoped) where.push(scoped);
  if (filter.queue) where.push(queueWhere(filter.queue));
  if (search) {
    where.push({
      OR: [
        { title: { contains: search } },
        { contactName: { contains: search } },
        { companyName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { reference: { contains: search } },
      ],
    });
  }
  return prisma.lead.findMany({
    where: {
      AND: where,
      stage: filter.stage,
      circuit: filter.circuit === 'none' ? null : filter.circuit,
      pipeline: filter.pipeline,
      kind: filter.kind,
      source: filter.source,
      assignedToId: filter.assignedToId,
    },
    include: LEAD_LIST_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
}

export async function getLead(id: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id, 'read');
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: STAFF_SELECT },
      salesAgent: { select: STAFF_SELECT },
      qualifiedBy: { select: STAFF_SELECT },
      referrer: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      // isPublic = espace membre déverrouillé (cf. situation/accountState.ts).
      user: {
        select: {
          id: true,
          email: true,
          referent: { select: STAFF_SELECT },
          profile: { select: { isPublic: true, firstName: true, lastName: true } },
        },
      },
      parentLead: { select: { id: true, reference: true, title: true, circuit: true } },
      childLeads: { select: { id: true, reference: true, title: true, kind: true, stage: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      serviceRequest: { include: { items: { orderBy: { createdAt: 'asc' } } } },
      contactMessage: true,
      circuitChanges: { include: { author: { select: STAFF_SELECT } }, orderBy: { createdAt: 'desc' } },
      activities: { include: { author: { select: STAFF_SELECT } }, orderBy: { occurredAt: 'desc' } },
      appointments: { include: { assignee: { select: STAFF_SELECT } }, orderBy: { startAt: 'asc' } },
      quotes: { select: { id: true, number: true, status: true, total: true, validUntil: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      invoices: { select: { id: true, number: true, proformaNumber: true, status: true, total: true, dueDate: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      serviceOrders: { select: { id: true, title: true, status: true, pole: true, expiresAt: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  // Justificatifs de paiement envoyés par le membre rattaché à ce lead.
  const paymentProofs = lead.userId
    ? await prisma.paymentProof.findMany({
        where: { userId: lead.userId },
        select: { id: true, status: true, fileName: true, mimeType: true, amount: true, reference: true, note: true, reviewNote: true, createdAt: true, quote: { select: { number: true } }, invoice: { select: { id: true, number: true, proformaNumber: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  return { ...lead, stageLabel: stageLabel(lead.stage, lead.circuit), paymentProofs };
}

export interface LeadInput {
  title: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  channel?: LeadChannel | null;
  channelDetail?: string | null;
  pipeline?: LeadPipeline | null;
  circuit?: LeadCircuit | null;
  expectedAmount?: number | null;
  notes?: string | null;
  offerInterest?: string | null;
  assignedToId?: string | null;
  nextActionAt?: Date | null;
  userId?: string | null;
}

/** Compte membre portant cette adresse email (pour rattacher un lead à son espace). */
export async function memberIdForEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email, role: 'MEMBER' }, select: { id: true } });
  return user?.id ?? null;
}

const normalizePhone = (phone: string) => phone.replace(/[\s.\-()]/g, '');

/**
 * « Un contact, une fiche » : un lead encore ouvert avec le même e-mail ou le
 * même téléphone. Les leads d'extension / renouvellement d'un membre ne
 * comptent pas (ils vivent à côté de sa fiche membre).
 */
export async function findOpenDuplicate(contact: { email?: string | null; phone?: string | null }, excludeId?: string) {
  const or: Prisma.LeadWhereInput[] = [];
  if (contact.email?.trim()) or.push({ email: contact.email.trim() });
  if (contact.phone?.trim()) {
    const phone = contact.phone.trim();
    or.push({ phone }, { phone: normalizePhone(phone) });
  }
  if (or.length === 0) return null;
  return prisma.lead.findFirst({
    where: { OR: or, stage: { in: OPEN_STAGES }, kind: 'NEW_BUSINESS', ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, reference: true, title: true, assignedTo: { select: STAFF_SELECT }, circuit: true },
    orderBy: { createdAt: 'asc' },
  });
}

async function assertNoDuplicate(contact: { email?: string | null; phone?: string | null }, excludeId?: string) {
  const duplicate = await findOpenDuplicate(contact, excludeId);
  if (duplicate) {
    throw new ApiError(
      409,
      'DUPLICATE_LEAD',
      `Ce contact est déjà suivi : ${duplicate.reference} — ${duplicate.title}${duplicate.assignedTo ? ` (${staffName(duplicate.assignedTo)})` : ' (à aiguiller)'}.`,
      { leadId: duplicate.id },
    );
  }
}

/** Le compte peut-il être intervenant sur un lead ? (staff actif ayant accès au CRM) */
export async function assertCrmStaff(userId: string, roles?: string[]) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, permissions: true, displayName: true, email: true } });
  const staff = await listStaffWith('crm');
  if (!target || !target.isActive || !staff.some((u) => u.id === userId) || (roles && !roles.includes(target.role))) {
    throw ApiError.badRequest('Ce compte ne peut pas recevoir ce lead.');
  }
  return target;
}

/** Avertit les comptes qui aiguillent les leads entrants (responsable commercial, Office Manager…). */
export async function notifyDispatchers(lead: { id: string; reference: string; title: string }, title: string, detail?: string) {
  const dispatchers = await listStaffWith('crm_manage');
  await notifyUsers(
    dispatchers.map((u) => u.id),
    'lead_new',
    title,
    `${lead.reference} — ${lead.title}${detail ? ` ${detail}` : ''}`,
    `/admin/crm/leads/${lead.id}`,
  );
}

/**
 * Saisie d'un lead par l'équipe. Le circuit découle de qui saisit : l'Office
 * Manager enregistre lui-même ses leads en circuit 2, un commercial ses leads de
 * prospection en circuit 1 ; le responsable commercial ou la Direction peuvent
 * l'aiguiller dès la saisie, sinon il attend dans « À aiguiller ».
 */
export async function createLead(input: LeadInput, actorId: string, scope?: StaffScope) {
  await assertNoDuplicate(input);
  const reference = await nextNumber('LD');
  const userId = input.userId ?? (await memberIdForEmail(input.email));
  const pipeline = input.channel ? CHANNEL_PIPELINE[input.channel] : input.pipeline ?? null;
  const now = new Date();

  let circuit: LeadCircuit | null = input.circuit ?? null;
  let assignedToId: string | null = null;
  let salesAgentId: string | null = null;

  if (scope?.officeManager) {
    circuit = input.circuit ?? 'OFFICE_MANAGER';
    if (circuit === 'OFFICE_MANAGER') assignedToId = actorId;
  } else if (scope && !scope.manageLeads && !scope.allLeads) {
    // Un commercial enregistre sa propre prospection.
    circuit = 'SALES_TEAM';
    assignedToId = actorId;
    salesAgentId = actorId;
  } else if (input.assignedToId) {
    const target = await assertCrmStaff(input.assignedToId);
    if (!circuit) circuit = target.role === 'OFFICE_MANAGER' ? 'OFFICE_MANAGER' : 'SALES_TEAM';
    assignedToId = target.id;
    if (circuit === 'SALES_TEAM') salesAgentId = target.id;
  } else if (scope?.salesManager && !circuit) {
    circuit = 'SALES_TEAM';
  }
  // Circuit 2 sans Office Manager désigné : le seul compte de ce rôle le prend, sinon il reste à aiguiller.
  if (circuit === 'OFFICE_MANAGER' && !assignedToId) {
    const oms = await listStaffByRole('OFFICE_MANAGER');
    if (oms.length === 1) assignedToId = oms[0].id;
    else circuit = null;
  }

  const lead = await prisma.lead.create({
    data: {
      reference,
      title: input.title,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      channel: input.channel,
      channelDetail: input.channelDetail,
      pipeline,
      expectedAmount: input.expectedAmount,
      notes: input.notes,
      offerInterest: input.offerInterest,
      nextActionAt: input.nextActionAt,
      userId,
      source: 'MANUAL',
      circuit,
      dispatchedAt: circuit ? now : null,
      assignedToId,
      salesAgentId,
      assignedAt: assignedToId ? now : null,
      stage: assignedToId ? 'ASSIGNED' : 'REGISTERED',
    },
  });
  await logActivity(lead.id, {
    content: circuit
      ? `Lead enregistré en ${circuit === 'SALES_TEAM' ? 'circuit 1 (Sales Team)' : 'circuit 2 (Office Manager)'}${assignedToId ? '' : ', à attribuer'}.`
      : 'Lead enregistré, à aiguiller.',
    authorId: actorId,
  });
  if (!circuit) await notifyDispatchers(lead, 'Nouveau lead à aiguiller');
  else if (circuit === 'SALES_TEAM' && !salesAgentId) {
    const managers = (await listStaffWith('crm_manage')).filter((u) => u.role !== 'OFFICE_MANAGER');
    await notifyUsers(managers.map((u) => u.id), 'lead_to_assign', 'Lead à attribuer', `${lead.reference} — ${lead.title}`, `/admin/crm/leads/${lead.id}`);
  } else if (assignedToId && assignedToId !== actorId) {
    await notifyUsers([assignedToId], 'lead_assigned', 'Lead attribué', `${lead.reference} — ${lead.title} vous a été confié.`, `/admin/crm/leads/${lead.id}`);
  }
  return lead;
}

/** Informations de la fiche. Circuit et intervenants passent par leadFlow (aiguillage, attribution, passerelle). */
export async function updateLead(id: string, patch: Partial<Omit<LeadInput, 'circuit' | 'assignedToId'>>, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound('Lead introuvable');
  if ((patch.email !== undefined && patch.email !== before.email) || (patch.phone !== undefined && patch.phone !== before.phone)) {
    if (before.kind === 'NEW_BUSINESS') await assertNoDuplicate({ email: patch.email ?? before.email, phone: patch.phone ?? before.phone }, id);
  }

  // Une adresse email ajoutée ou corrigée peut désormais correspondre à un membre.
  const userId = patch.email !== undefined && !before.userId ? await memberIdForEmail(patch.email) : undefined;
  const { userId: _ignored, ...rest } = patch;
  void _ignored;
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      ...(patch.channel ? { pipeline: CHANNEL_PIPELINE[patch.channel] } : {}),
      ...(userId ? { userId } : {}),
      // Reprogrammer l'action suivante réarme l'alerte automatique.
      ...(rest.nextActionAt !== undefined ? { nextActionAlertedAt: null } : {}),
    },
  });
  void actorId;
  return updated;
}

/** Fait avancer un lead sans jamais le faire reculer ni rouvrir un lead clos. */
export async function advanceStageTo(id: string, stage: LeadStage, actorId?: string | null) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.stage === 'PAID' || lead.stage === 'LOST') return;
  if (STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(lead.stage)) return;
  const now = new Date();
  await prisma.lead.update({
    where: { id },
    data: {
      stage,
      ...(stage === 'CONFIRMED' ? { confirmedAt: now } : {}),
      ...(stage === 'PAID' ? { wonAt: now, nextActionAt: null } : {}),
      followUpReturnedAt: null,
    },
  });
  await logActivity(id, { content: `Étape : ${stageLabel(lead.stage, lead.circuit)} → ${stageLabel(stage, lead.circuit)}.`, authorId: actorId });
}

export async function addActivity(
  leadId: string,
  input: { type: ActivityType; content: string; occurredAt?: Date; mentionIds?: string[] },
  authorId: string,
  scope?: StaffScope,
) {
  await assertLeadAccess(scope, leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');

  const activity = await logActivity(leadId, { ...input, authorId });
  // Toute activité « touche » la fiche : elle sort de la liste des dormants.
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date(), dormantAlertedAt: null } });

  const mentions = (input.mentionIds ?? []).filter((id) => id !== authorId);
  if (mentions.length) {
    await notifyUsers(mentions, 'lead_mention', 'Vous êtes mentionné', `${lead.reference} — ${lead.title} : ${input.content.slice(0, 140)}`, `/admin/crm/leads/${lead.id}`);
  }
  return activity;
}

// --- Rendez-vous -------------------------------------------------------------

export async function listAppointments(filter: { from: Date; to: Date; assigneeId?: string }, scope?: StaffScope) {
  const scoped = leadScopeWhere(scope);
  return prisma.appointment.findMany({
    where: { startAt: { gte: filter.from, lt: filter.to }, assigneeId: filter.assigneeId, ...(scoped ? { lead: scoped } : {}) },
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

export const APPOINTMENT_LABEL: Record<AppointmentType, string> = {
  CALL: 'Appel',
  VISIT: 'Visite',
  VIDEO: 'Visio',
  TRIAL_DAY: 'Journée d’essai',
  MEETING: 'Réunion',
};

const when = (date: Date) => date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export async function createAppointment(leadId: string, input: AppointmentInput, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  const appointment = await prisma.appointment.create({
    data: { ...input, leadId, assigneeId: input.assigneeId === undefined ? actorId : input.assigneeId },
  });
  await logActivity(leadId, { content: `${APPOINTMENT_LABEL[input.type]} programmé(e) le ${when(input.startAt)}.`, authorId: actorId });
  return appointment;
}

/**
 * Tâche planifiée de l'équipe, rangée dans l'agenda comme un rendez-vous
 * (appel à passer, check-in, suivi d'essai). Sans lead, pas d'agenda : on ignore.
 */
export async function scheduleTask(leadId: string | null | undefined, input: { type?: AppointmentType; startAt: Date; assigneeId: string | null; notes: string }) {
  if (!leadId) return null;
  return prisma.appointment.create({
    data: { leadId, type: input.type ?? 'CALL', startAt: input.startAt, assigneeId: input.assigneeId, notes: input.notes },
  });
}

export async function updateAppointment(
  id: string,
  patch: Partial<AppointmentInput> & { status?: AppointmentStatus },
  actorId: string,
  scope?: StaffScope,
) {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Rendez-vous introuvable');
  await assertLeadAccess(scope, existing.leadId);
  const updated = await prisma.appointment.update({
    where: { id },
    data: { ...patch, ...(patch.startAt ? { reminderSentAt: null } : {}) },
  });
  if (patch.status && patch.status !== existing.status) {
    const label = patch.status === 'DONE' ? 'effectué(e)' : patch.status === 'CANCELLED' ? 'annulé(e)' : 'reprogrammé(e)';
    await logActivity(existing.leadId, { content: `${APPOINTMENT_LABEL[existing.type]} ${label}.`, authorId: actorId });
    // Journée d'essai effectuée : suivi à J+3 (paramétrable) par la même personne.
    if (patch.status === 'DONE' && existing.type === 'TRIAL_DAY') {
      const { trialFollowUpDays } = await getSettings();
      const followUpAt = new Date(Date.now() + trialFollowUpDays * 24 * 3600 * 1000);
      await scheduleTask(existing.leadId, { startAt: followUpAt, assigneeId: existing.assigneeId, notes: `Suivi de la journée d’essai (J+${trialFollowUpDays}).` });
      await prisma.lead.update({ where: { id: existing.leadId }, data: { nextActionAt: followUpAt, nextActionAlertedAt: null } });
    }
  }
  return updated;
}

export async function deleteAppointment(id: string, scope?: StaffScope) {
  const existing = await prisma.appointment.findUnique({ where: { id }, select: { leadId: true } });
  if (!existing) throw ApiError.notFound('Rendez-vous introuvable');
  await assertLeadAccess(scope, existing.leadId);
  await prisma.appointment.delete({ where: { id } });
}

// --- Recherche globale (Ctrl+K) ---------------------------------------------------

export async function globalSearch(query: string, scope?: StaffScope) {
  const q = query.trim();
  if (q.length < 2) return { leads: [], quotes: [], invoices: [] };
  const scoped = leadScopeWhere(scope);
  const viaLead = scoped ? { lead: scoped } : {};
  const [leads, quotes, invoices] = await Promise.all([
    prisma.lead.findMany({
      where: {
        AND: [scoped ?? {}, { OR: [{ reference: { contains: q } }, { title: { contains: q } }, { contactName: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }],
      },
      select: { id: true, reference: true, title: true, contactName: true, stage: true, circuit: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    prisma.quote.findMany({
      where: { ...viaLead, OR: [{ number: { contains: q } }, { lead: { contactName: { contains: q } } }, { lead: { companyName: { contains: q } } }] },
      select: { id: true, number: true, status: true, total: true, lead: { select: { contactName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { ...viaLead, OR: [{ number: { contains: q } }, { proformaNumber: { contains: q } }, { customerName: { contains: q } }, { customerCompany: { contains: q } }] },
      select: { id: true, number: true, proformaNumber: true, status: true, total: true, customerName: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  return { leads, quotes, invoices };
}

export { STAGE_LABEL };
