import type { Prisma, LeadSource, LeadStage, LeadPriority, ActivityType, AppointmentType, AppointmentStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { hasResourceAccess, parsePermissions } from '../admin/permissions';
import { requestLabel } from '../services/requestLabel';
// Import circulaire assumé (situation.service importe ce module) : utilisé à l'appel, jamais au chargement.
import { approveAccount } from '../situation/situation.service';
import { nextNumber } from './numbering';
import { assertCanManage, assertLeadAccess, leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, listStaffWith, notifyUsers, staffName } from './staff';

// Cœur du CRM : leads / opportunités (un même enregistrement qui avance dans
// le pipeline), journal d'activité, rendez-vous, tableau de bord.
//
// Parcours (demande client 19/10/2026), un seul flux :
//   NEW (à qualifier) → QUALIFIED (validé par le responsable commercial, à
//   assigner) → ASSIGNED (confié à un commercial) → CONTACTED → QUOTE_SENT →
//   WON / LOST.
// Un commercial ne voit que ses leads assignés (cf. scope.ts).

export const STAGE_ORDER: LeadStage[] = ['NEW', 'QUALIFIED', 'ASSIGNED', 'CONTACTED', 'QUOTE_SENT', 'WON', 'LOST'];
export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'À qualifier',
  QUALIFIED: 'À assigner',
  ASSIGNED: 'Assigné',
  CONTACTED: 'Contacté',
  QUOTE_SENT: 'Devis envoyé',
  WON: 'Gagné',
  LOST: 'Perdu',
};
const OPEN_STAGES: LeadStage[] = ['NEW', 'QUALIFIED', 'ASSIGNED', 'CONTACTED', 'QUOTE_SENT'];
/** Étapes que seul le responsable commercial pose à la main (qualification / assignation). */
const MANAGER_STAGES: LeadStage[] = ['NEW', 'QUALIFIED', 'ASSIGNED'];
export const PRIORITY_LABEL: Record<LeadPriority, string> = { COLD: 'Froid', WARM: 'Tiède', HOT: 'Chaud' };

const LEAD_LIST_INCLUDE = {
  assignedTo: { select: STAFF_SELECT },
  // Compte membre rattaché (isPublic = compte validé) : la qualification peut le valider d'un coup.
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

// --- Leads -------------------------------------------------------------------

export interface LeadListFilter {
  stage?: LeadStage;
  /** null = leads non assignés ; undefined = pas de filtre. */
  assignedToId?: string | null;
  source?: LeadSource;
  search?: string;
}

/** Journal global (reporting quotidien des commerciaux). */
export async function listActivities(
  filter: { authorId?: string; type?: ActivityType; from?: Date; to?: Date; search?: string },
  scope?: StaffScope,
) {
  const search = filter.search?.trim();
  return prisma.leadActivity.findMany({
    where: {
      authorId: filter.authorId,
      type: filter.type,
      occurredAt: { gte: filter.from, lte: filter.to },
      ...(scope && !scope.allLeads ? { lead: leadScopeWhere(scope) } : {}),
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

export async function listLeads(filter: LeadListFilter, scope?: StaffScope) {
  const search = filter.search?.trim();
  const scoped = leadScopeWhere(scope);
  return prisma.lead.findMany({
    where: {
      stage: filter.stage,
      // Un commercial ne peut pas élargir sa vue via le filtre « commercial ».
      assignedToId: scoped ? scoped.assignedToId : filter.assignedToId,
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

export async function getLead(id: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: STAFF_SELECT },
      qualifiedBy: { select: STAFF_SELECT },
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

/** Le compte peut-il recevoir des leads ? (staff actif ayant accès au CRM) */
async function assertAssignable(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, permissions: true } });
  if (!target || !target.isActive || !hasResourceAccess(target.role, parsePermissions(target.permissions), 'crm')) {
    throw ApiError.badRequest('Ce compte ne peut pas recevoir de leads (accès au CRM requis).');
  }
  return target;
}

export async function createLead(input: LeadInput, actorId: string, scope?: StaffScope) {
  const reference = await nextNumber('LD');
  const userId = input.userId ?? (await memberIdForEmail(input.email));
  const isManager = !scope || scope.manageLeads;

  // Un commercial qui crée un lead se l'attribue (il le voit dès sa création) mais
  // le lead reste « À qualifier » jusqu'à validation du responsable commercial.
  // Un responsable qui crée un lead en le confiant d'emblée le valide de fait.
  const requested = isManager ? input.assignedToId ?? null : actorId;
  if (requested) await assertAssignable(requested);
  const validatedByCreator = isManager && Boolean(requested);

  const lead = await prisma.lead.create({
    data: {
      ...input,
      userId,
      reference,
      assignedToId: requested,
      assignedAt: requested && validatedByCreator ? new Date() : null,
      stage: validatedByCreator ? 'ASSIGNED' : 'NEW',
      qualifiedAt: validatedByCreator ? new Date() : null,
      qualifiedById: validatedByCreator ? actorId : null,
      source: input.source ?? 'OTHER',
    },
  });
  await logActivity(lead.id, {
    content: validatedByCreator ? 'Lead créé manuellement et assigné.' : 'Lead créé manuellement, en attente de qualification.',
    authorId: actorId,
  });
  if (!validatedByCreator) await notifyManagers(lead, 'Nouveau lead à qualifier');
  return lead;
}

/** Avertit les comptes qui qualifient les leads (responsable commercial, office manager…). */
async function notifyManagers(lead: { id: string; reference: string; title: string }, title: string, detail?: string) {
  const managers = await listStaffWith('crm_manage');
  await notifyUsers(
    managers.map((u) => u.id),
    'lead_new',
    title,
    `${lead.reference} — ${lead.title}${detail ? ` ${detail}` : ''}`,
    '/admin/crm/entrants',
  );
}

export async function updateLead(id: string, patch: Partial<LeadInput>, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound('Lead introuvable');

  // L'assignation est un acte de gestion (cf. assignLead) : elle ne passe plus
  // par la simple modification des informations.
  const { assignedToId, ...rest } = patch;
  if (assignedToId !== undefined && assignedToId !== before.assignedToId) {
    await assignLead(id, assignedToId, actorId, scope);
  }

  // Une adresse email ajoutée ou corrigée peut désormais correspondre à un membre.
  const userId = rest.email !== undefined && !before.userId ? await memberIdForEmail(rest.email) : undefined;
  return prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      ...(userId ? { userId } : {}),
      // Reprogrammer l'action suivante réarme l'alerte automatique.
      ...(rest.nextActionAt !== undefined ? { nextActionAlertedAt: null } : {}),
    },
  });
}

// --- Qualification, validation, assignation (responsable commercial) --------

export interface QualificationInput {
  priority: LeadPriority;
  need?: string | null;
  budget?: string | null;
  decisionMaker?: string | null;
  timeline?: string | null;
  notes?: string | null;
  /** Assigner dans la foulée (« valider et assigner »). */
  assignedToId?: string | null;
  /**
   * Valider aussi le compte membre rattaché au lead (déverrouille son espace). Par défaut oui :
   * qualifier une inscription et valider le compte sont un seul et même geste.
   */
  validateAccount?: boolean;
}

/** Qualifie un lead entrant et le valide : il passe « À assigner » (ou « Assigné » si un commercial est choisi). */
export async function qualifyLead(id: string, input: QualificationInput, actorId: string, scope?: StaffScope) {
  assertCanManage(scope);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  if (lead.stage !== 'NEW') throw ApiError.conflict('Ce lead est déjà qualifié.');

  const assigneeId = input.assignedToId === undefined ? lead.assignedToId : input.assignedToId;
  if (assigneeId) await assertAssignable(assigneeId);

  const { priority, assignedToId: _ignored, validateAccount, ...qualification } = input;
  void _ignored;
  const now = new Date();
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      priority,
      qualification: qualification as Prisma.InputJsonValue,
      qualifiedAt: now,
      qualifiedById: actorId,
      stage: assigneeId ? 'ASSIGNED' : 'QUALIFIED',
      assignedToId: assigneeId ?? null,
      assignedAt: assigneeId ? now : null,
    },
    include: { assignedTo: { select: STAFF_SELECT } },
  });

  await logActivity(id, {
    content: `Lead qualifié et validé (${PRIORITY_LABEL[priority].toLowerCase()})${updated.assignedTo ? ` — assigné à ${staffName(updated.assignedTo)}` : ' — à assigner'}.`,
    authorId: actorId,
  });
  if (assigneeId && assigneeId !== actorId) {
    await notifyUsers([assigneeId], 'lead_assigned', 'Lead assigné', `${lead.reference} — ${lead.title} vous a été confié.`, `/admin/crm/leads/${lead.id}`);
  }
  // Un lead issu d'une inscription : le valider valide le compte du membre (un seul geste).
  if (lead.userId && validateAccount !== false) {
    await approveAccount(lead.userId, actorId);
  }
  return updated;
}

/** Assigne (ou réassigne) un lead validé à un commercial. */
export async function assignLead(id: string, assigneeId: string | null, actorId: string, scope?: StaffScope) {
  assertCanManage(scope);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  if (lead.stage === 'WON' || lead.stage === 'LOST') throw ApiError.conflict('Ce lead est clos.');
  if (lead.stage === 'NEW') throw ApiError.conflict('Qualifiez et validez ce lead avant de l’assigner.');
  if (assigneeId === null && lead.stage !== 'ASSIGNED' && lead.stage !== 'QUALIFIED') {
    throw ApiError.conflict('Un lead en cours de traitement se réassigne à un autre commercial, il ne peut pas rester sans responsable.');
  }
  if (assigneeId) await assertAssignable(assigneeId);
  if (assigneeId === lead.assignedToId) return lead;

  const target = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId }, select: STAFF_SELECT }) : null;
  const stage: LeadStage = assigneeId ? (lead.stage === 'QUALIFIED' ? 'ASSIGNED' : lead.stage) : 'QUALIFIED';
  const updated = await prisma.lead.update({
    where: { id },
    data: { assignedToId: assigneeId, assignedAt: assigneeId ? new Date() : null, stage },
  });
  await logActivity(id, {
    content: target ? `Lead assigné à ${staffName(target)}.` : 'Lead désassigné, retour à assigner.',
    authorId: actorId,
  });
  if (target && target.id !== actorId) {
    await notifyUsers([target.id], 'lead_assigned', 'Lead assigné', `${lead.reference} — ${lead.title} vous a été confié.`, `/admin/crm/leads/${lead.id}`);
  }
  if (lead.assignedToId && lead.assignedToId !== assigneeId && lead.assignedToId !== actorId) {
    await notifyUsers([lead.assignedToId], 'lead_unassigned', 'Lead réassigné', `${lead.reference} — ${lead.title} a été confié à un autre commercial.`, '/admin/crm/pipeline');
  }
  return updated;
}

export async function changeStage(id: string, stage: LeadStage, actorId: string, lostReason?: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  if (lead.stage === stage) return lead;

  const manager = !scope || scope.manageLeads;
  if (!manager) {
    if (MANAGER_STAGES.includes(lead.stage)) {
      throw ApiError.forbidden('Ce lead attend la validation du responsable commercial.');
    }
    if (MANAGER_STAGES.includes(stage)) {
      throw ApiError.forbidden('Seul le responsable commercial peut ramener un lead à l’étape de qualification ou d’assignation.');
    }
  }
  if (stage === 'ASSIGNED' && !lead.assignedToId) {
    throw ApiError.badRequest('Choisissez d’abord le commercial à qui confier ce lead.');
  }
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
  scope?: StaffScope,
) {
  await assertLeadAccess(scope, leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');

  const activity = await logActivity(leadId, { ...input, authorId });
  // Toute activité « touche » la fiche : elle sort de la liste des dormants.
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date(), dormantAlertedAt: null } });
  // Premier échange réel (appel, email, réunion, visite) : le lead passe « Contacté ».
  if (lead.stage === 'ASSIGNED' && input.type !== 'NOTE') await advanceStageTo(leadId, 'CONTACTED', authorId);

  const mentions = (input.mentionIds ?? []).filter((id) => id !== authorId);
  if (mentions.length) {
    await notifyUsers(mentions, 'lead_mention', 'Vous êtes mentionné', `${lead.reference} — ${lead.title} : ${input.content.slice(0, 140)}`, `/admin/crm/leads/${lead.id}`);
  }
  return activity;
}

// --- Rendez-vous -------------------------------------------------------------

export async function listAppointments(filter: { from: Date; to: Date; assigneeId?: string }, scope?: StaffScope) {
  return prisma.appointment.findMany({
    where: { startAt: { gte: filter.from, lt: filter.to }, assigneeId: filter.assigneeId, ...(scope && !scope.allLeads ? { lead: leadScopeWhere(scope) } : {}) },
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

export async function createAppointment(leadId: string, input: AppointmentInput, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  const appointment = await prisma.appointment.create({
    data: { ...input, leadId, assigneeId: input.assigneeId === undefined ? actorId : input.assigneeId },
  });
  await logActivity(leadId, {
    content: `Rendez-vous programmé le ${input.startAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}.`,
    authorId: actorId,
  });
  if (lead.stage === 'ASSIGNED') await advanceStageTo(leadId, 'CONTACTED', actorId);
  return appointment;
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
    const label = patch.status === 'DONE' ? 'effectué' : patch.status === 'CANCELLED' ? 'annulé' : 'reprogrammé';
    await logActivity(existing.leadId, { content: `Rendez-vous ${label}.`, authorId: actorId });
  }
  return updated;
}

export async function deleteAppointment(id: string, scope?: StaffScope) {
  const existing = await prisma.appointment.findUnique({ where: { id }, select: { leadId: true } });
  if (!existing) throw ApiError.notFound('Rendez-vous introuvable');
  await assertLeadAccess(scope, existing.leadId);
  await prisma.appointment.delete({ where: { id } });
}

// --- Entrées automatiques ------------------------------------------------------
// Tous les leads entrants arrivent « À qualifier » : le responsable commercial
// (et les comptes qui ont le droit de qualifier) sont avertis.

/** Demande de devis du site (panier) → lead « À qualifier », prérempli depuis le compte. */
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
  await notifyManagers(lead, 'Nouveau lead à qualifier', `(${contactName}) vient d'arriver depuis le site.`);
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
  await notifyManagers(lead, 'Nouvelle inscription à qualifier', `— ${contactName}${companyName ? ` (${companyName})` : ''} vient de créer un compte, à valider.`);
  return lead;
}

/** Formulaire /contact → lead « À qualifier ». */
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
  await notifyManagers(lead, 'Nouveau lead à qualifier', `— message de ${message.name} reçu via le formulaire de contact.`);
  return lead;
}

// --- Tableau de bord ------------------------------------------------------------

export async function getDashboard(scope?: StaffScope) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  // Un commercial ne voit que ses chiffres ; le responsable voit toute l'équipe.
  const scoped = leadScopeWhere(scope);
  const leadWhere = scoped ?? {};
  // `lead: {}` exclurait les factures sans lead : on n'ajoute le filtre que si la portée est restreinte.
  const viaLead = scoped ? { lead: scoped } : {};

  const [byStage, bySource, openByAssignee, overdueActions, todayAppointments, weekAppointments, pendingQuotes, receivable, paidInvoices, leadsCreated, ninetyDay, toLaunch, staff] =
    await Promise.all([
      prisma.lead.groupBy({ by: ['stage'], where: leadWhere, _count: { _all: true }, _sum: { expectedAmount: true } }),
      prisma.lead.groupBy({ by: ['source'], where: leadWhere, _count: { _all: true } }),
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
        where: { ...leadWhere, stage: { in: ['WON', 'LOST'] }, updatedAt: { gte: new Date(now.getTime() - 90 * 24 * 3600 * 1000) } },
        _count: { _all: true },
      }),
      prisma.serviceOrder.count({ where: { status: 'TO_START', ...(scope && !scope.allLeads ? { OR: [{ assignedToId: scope.userId }, viaLead] } : {}) } }),
      prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT'] } }, select: STAFF_SELECT }),
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
    scope: !scope || scope.allLeads ? ('team' as const) : ('mine' as const),
    canManage: !scope || scope.manageLeads,
    kpis: {
      openLeads: openLeads.reduce((sum, s) => sum + s.count, 0),
      pipelineAmount: openLeads.reduce((sum, s) => sum + s.amount, 0),
      toQualify: stageMap.get('NEW')?._count._all ?? 0,
      toAssign: stageMap.get('QUALIFIED')?._count._all ?? 0,
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

export async function globalSearch(query: string, scope?: StaffScope) {
  const q = query.trim();
  if (q.length < 2) return { leads: [], quotes: [], invoices: [] };
  const scoped = leadScopeWhere(scope);
  const leadWhere = scoped ?? {};
  const viaLead = scoped ? { lead: scoped } : {};
  const [leads, quotes, invoices] = await Promise.all([
    prisma.lead.findMany({
      where: { ...leadWhere, OR: [{ reference: { contains: q } }, { title: { contains: q } }, { contactName: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, reference: true, title: true, contactName: true, stage: true },
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
      where: { ...viaLead, OR: [{ number: { contains: q } }, { customerName: { contains: q } }, { customerCompany: { contains: q } }] },
      select: { id: true, number: true, status: true, total: true, customerName: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  return { leads, quotes, invoices };
}
