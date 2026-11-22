import type { AppointmentType, LeadCircuit, LeadPriority, LeadStage, Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { getSettings } from '../settings/settings.service';
import { APPOINTMENT_LABEL, PRIORITY_LABEL, assertCrmStaff, logActivity, pickOfficeManager } from './leads.service';
import { assertCanManage, assertLeadAccess, type StaffScope } from './scope';
import { STAFF_SELECT, listStaffWith, notifyUsers, staffName } from './staff';
import { CIRCUIT_LABEL, PRE_VISIT_STAGES, isOpen, stageLabel } from './workflow';

// Parcours d'un lead, phases 1 et 2 du processus commercial v1.3 :
//   aiguillage (circuit 1 ou 2) → attribution (circuit 1) ou prise en charge
//   (circuit 2) → qualification → relances → visite / visio confirmée, qui
//   transmet le dossier du commercial à l'Office Manager en circuit 1.
// Les étapes suivantes avancent avec les documents : devis envoyé, confirmé,
// paiement (quotes / invoices.service.ts).
// Chaque geste écrit une ligne datée dans le journal de la fiche.

const DAY = 24 * 3600 * 1000;
const leadUrl = (id: string) => `/admin/crm/leads/${id}`;

async function loadLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id }, include: { assignedTo: { select: STAFF_SELECT }, salesAgent: { select: STAFF_SELECT } } });
  if (!lead) throw ApiError.notFound('Lead introuvable');
  return lead;
}

function assertOpen(lead: { stage: LeadStage }) {
  if (!isOpen(lead.stage)) throw ApiError.conflict('Ce lead est clos.');
}

/** Office Manager qui reçoit un dossier : celle choisie, l'actrice si c'est elle, sinon la moins chargée. */
async function resolveOfficeManager(chosenId: string | null | undefined, actorId: string, actorIsOm: boolean) {
  if (chosenId) return (await assertCrmStaff(chosenId, ['OFFICE_MANAGER', 'ADMIN', 'SUPER_ADMIN'])).id;
  if (actorIsOm) return actorId;
  const omId = await pickOfficeManager();
  if (!omId) throw ApiError.badRequest('Aucun compte Office Manager actif : créez-en un depuis « Utilisateurs système ».');
  return omId;
}

async function notifySalesManagers(lead: { id: string; reference: string; title: string }, type: string, title: string, detail?: string) {
  const managers = (await listStaffWith('crm_manage')).filter((u) => u.role !== 'OFFICE_MANAGER');
  await notifyUsers(managers.map((u) => u.id), type, title, `${lead.reference} — ${lead.title}${detail ? ` ${detail}` : ''}`, leadUrl(lead.id));
}

// --- Phase 1 : aiguillage, attribution, prise en charge ------------------------

/**
 * Question d'aiguillage : le prospect nécessite-t-il un travail commercial ?
 * Oui → circuit 1 (le responsable commercial l'attribue, éventuellement dans
 * la foulée) ; non → circuit 2 (un Office Manager le prend en charge).
 */
export async function dispatchLead(id: string, input: { circuit: LeadCircuit; assignedToId?: string | null }, actorId: string, scope?: StaffScope) {
  assertCanManage(scope);
  const lead = await loadLead(id);
  assertOpen(lead);
  if (lead.circuit) throw ApiError.conflict('Ce lead a déjà un intervenant.');
  const now = new Date();

  if (input.circuit === 'OFFICE_MANAGER') {
    const omId = await resolveOfficeManager(input.assignedToId, actorId, Boolean(scope?.officeManager));
    const updated = await prisma.lead.update({
      where: { id },
      data: { circuit: 'OFFICE_MANAGER', dispatchedAt: now, assignedToId: omId, assignedAt: now, stage: 'ASSIGNED' },
      include: { assignedTo: { select: STAFF_SELECT } },
    });
    await logActivity(id, { content: `Pris en charge par l’Office Manager : ${staffName(updated.assignedTo!)}.`, authorId: actorId });
    if (omId !== actorId) await notifyUsers([omId], 'lead_assigned', 'Lead à prendre en charge', `${lead.reference} — ${lead.title}`, leadUrl(id));
    return updated;
  }

  // Circuit 1 : seul le pilote de la Sales Team (ou la Direction) attribue dans la foulée.
  const canAttribute = !scope || scope.salesManager || scope.direction;
  if (input.assignedToId && canAttribute) {
    await prisma.lead.update({ where: { id }, data: { circuit: 'SALES_TEAM', dispatchedAt: now } });
    await logActivity(id, { content: 'Confié à l’équipe commerciale.', authorId: actorId });
    return assignLead(id, input.assignedToId, actorId, scope);
  }
  const updated = await prisma.lead.update({ where: { id }, data: { circuit: 'SALES_TEAM', dispatchedAt: now } });
  await logActivity(id, { content: 'Confié à l’équipe commerciale : commercial à désigner.', authorId: actorId });
  await notifySalesManagers(lead, 'lead_to_assign', 'Lead à attribuer');
  return updated;
}

/**
 * Confier un lead à un commercial (ou le réattribuer), avant la visite. Depuis
 * les retours du 22/11/2026, l'Office Manager reçoit tous les prospects et les
 * confie elle-même à un commercial quand un travail commercial est nécessaire ;
 * le responsable commercial et la Direction le peuvent aussi.
 */
export async function assignLead(id: string, agentId: string | null, actorId: string, scope?: StaffScope): Promise<unknown> {
  if (scope && !scope.salesManager && !scope.direction && !scope.officeManager) {
    throw ApiError.forbidden('Seuls l’Office Manager, le responsable commercial et la Direction confient un lead à un commercial.');
  }
  let lead = await loadLead(id);
  assertOpen(lead);
  if (lead.handedOverAt) throw ApiError.conflict('Ce dossier a déjà été transmis à l’Office Manager après la visite.');
  if (lead.circuit !== 'SALES_TEAM') {
    if (!agentId) return lead;
    if (['VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED'].includes(lead.stage)) {
      throw ApiError.conflict('La visite est déjà confirmée ou un devis est en cours : le dossier reste chez l’Office Manager.');
    }
    // Lead de l'Office Manager (ou sans intervenant) confié à un commercial.
    await assertCrmStaff(agentId, ['SALES_AGENT', 'SALES_MANAGER']);
    await prisma.$transaction([
      prisma.lead.update({ where: { id }, data: { circuit: 'SALES_TEAM', dispatchedAt: lead.dispatchedAt ?? new Date(), salesAgentId: null, followUpCount: 0, followUpReturnedAt: null } }),
      prisma.leadCircuitChange.create({ data: { leadId: id, fromCircuit: lead.circuit, toCircuit: 'SALES_TEAM', reason: 'Confié à un commercial par l’Office Manager', authorId: actorId } }),
    ]);
    lead = await loadLead(id);
  }
  if (agentId === lead.salesAgentId) return lead;

  if (agentId === null) {
    // Retiré au commercial : le lead revient chez l'Office Manager.
    if (lead.stage !== 'ASSIGNED' && lead.stage !== 'REGISTERED') {
      throw ApiError.conflict('Un lead en cours de traitement se confie à un autre commercial ou se renvoie à l’Office Manager.');
    }
    return changeCircuit(id, { circuit: 'OFFICE_MANAGER', reason: 'Retiré au commercial' }, actorId, scope);
  }

  const target = await assertCrmStaff(agentId, ['SALES_AGENT', 'SALES_MANAGER']);
  const now = new Date();
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      salesAgentId: target.id,
      assignedToId: target.id,
      assignedAt: now,
      stage: lead.stage === 'REGISTERED' ? 'ASSIGNED' : lead.stage,
      // Réattribuer un lead revenu sans réponse le remet en circulation.
      followUpReturnedAt: null,
      followUpCount: lead.followUpReturnedAt ? 0 : lead.followUpCount,
    },
  });
  await logActivity(id, { content: `Lead attribué à ${staffName(target)}.`, authorId: actorId });
  if (target.id !== actorId) await notifyUsers([target.id], 'lead_assigned', 'Lead attribué', `${lead.reference} — ${lead.title} vous a été confié.`, leadUrl(id));
  if (lead.salesAgentId && lead.salesAgentId !== target.id && lead.salesAgentId !== actorId) {
    await notifyUsers([lead.salesAgentId], 'lead_unassigned', 'Lead réattribué', `${lead.reference} — ${lead.title} a été confié à un autre commercial.`, '/admin/crm/pipeline');
  }
  return updated;
}

// --- Passerelle entre les circuits -----------------------------------------------

/**
 * L'Office Manager confie à la Sales Team un lead qui demande un travail de
 * qualification ; la Sales Team renvoie à l'Office Manager un lead prêt à être
 * traité. Motif obligatoire, consigné sur la fiche : c'est ce qui fige le
 * circuit et évite les doubles commissions.
 */
export async function changeCircuit(
  id: string,
  input: { circuit: LeadCircuit; reason?: string | null; officeManagerId?: string | null; salesAgentId?: string | null },
  actorId: string,
  scope?: StaffScope,
): Promise<unknown> {
  await assertLeadAccess(scope, id);
  // Confier à un commercial précis : c'est une attribution directe.
  if (input.circuit === 'SALES_TEAM' && input.salesAgentId) return assignLead(id, input.salesAgentId, actorId, scope);
  const lead = await loadLead(id);
  assertOpen(lead);
  if (!lead.circuit) throw ApiError.conflict('Ce lead n’a pas encore d’intervenant.');
  if (lead.circuit === input.circuit) throw ApiError.conflict(`Ce lead est déjà ${CIRCUIT_LABEL[input.circuit].toLowerCase()}.`);
  if (lead.handedOverAt) throw ApiError.conflict('Ce dossier a déjà été transmis après la visite : son circuit est figé.');
  if (['QUOTE_SENT', 'CONFIRMED'].includes(lead.stage)) throw ApiError.conflict('Un devis est en cours : le circuit ne change plus.');
  const reason = input.reason?.trim() || (input.circuit === 'OFFICE_MANAGER' ? 'Renvoyé à l’Office Manager' : 'Commercial à désigner');
  const now = new Date();

  let data: Prisma.LeadUpdateInput;
  let summary: string;
  let notify: { ids: string[]; title: string } | null = null;
  if (input.circuit === 'SALES_TEAM') {
    data = { circuit: 'SALES_TEAM', assignedTo: { disconnect: true }, salesAgent: { disconnect: true }, assignedAt: null, stage: 'REGISTERED', followUpCount: 0, followUpReturnedAt: null };
    summary = 'confié à l’équipe commerciale, commercial à désigner';
    const managers = (await listStaffWith('crm_manage')).filter((u) => u.role !== 'OFFICE_MANAGER');
    notify = { ids: managers.map((u) => u.id), title: 'Lead à confier à un commercial' };
  } else {
    const omId = await resolveOfficeManager(input.officeManagerId, actorId, Boolean(scope?.officeManager));
    data = {
      circuit: 'OFFICE_MANAGER',
      assignedTo: { connect: { id: omId } },
      // Plus de closer Sales Team : le lead suit désormais le circuit 2.
      salesAgent: { disconnect: true },
      assignedAt: now,
      stage: lead.stage === 'REGISTERED' ? 'ASSIGNED' : lead.stage,
      followUpReturnedAt: null,
    };
    summary = 'renvoyé à l’Office Manager, prêt à être traité';
    notify = { ids: [omId], title: 'Lead renvoyé à l’Office Manager' };
  }

  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data }),
    prisma.leadCircuitChange.create({ data: { leadId: id, fromCircuit: lead.circuit, toCircuit: input.circuit, reason, authorId: actorId } }),
  ]);
  await logActivity(id, { content: `Lead ${summary}. Motif : ${reason}`, authorId: actorId });
  if (notify) await notifyUsers(notify.ids.filter((u) => u !== actorId), 'lead_circuit', notify.title, `${lead.reference} — ${lead.title} (${reason})`, leadUrl(id));
  return loadLead(id);
}

// --- Phase 2 : qualification et orientation --------------------------------------

export interface QualificationInput {
  priority: LeadPriority;
  profile?: string | null;
  project?: string | null;
  /** Étape de développement du projet. */
  maturity?: string | null;
  need?: string | null;
  budget?: string | null;
  decisionMaker?: string | null;
  timeline?: string | null;
  notes?: string | null;
  /** Offre pressentie : Starter, Builder, Accelerator, Domiciliation Pro… */
  offerInterest?: string | null;
}

/** Comprendre puis orienter : réalisée par le commercial (circuit 1) ou l'Office Manager (circuit 2). */
export async function qualifyLead(id: string, input: QualificationInput, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const lead = await loadLead(id);
  assertOpen(lead);
  if (!lead.assignedToId) throw ApiError.conflict('Attribuez ou prenez en charge ce lead avant de le qualifier.');
  const { priority, offerInterest, ...qualification } = input;
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      priority,
      offerInterest: offerInterest ?? lead.offerInterest,
      qualification: qualification as Prisma.InputJsonValue,
      qualifiedAt: new Date(),
      qualifiedById: actorId,
      // Requalifier plus tard (après une visite…) ne fait pas reculer le lead.
      stage: PRE_VISIT_STAGES.includes(lead.stage) ? 'QUALIFIED' : lead.stage,
    },
  });
  await logActivity(id, {
    content: `Lead qualifié (${PRIORITY_LABEL[priority].toLowerCase()})${offerInterest ? `, offre pressentie : ${offerInterest}` : ''}.`,
    authorId: actorId,
  });
  return updated;
}

/**
 * Relance (le client n'a pas encore confirmé de visite). Au-delà du nombre de
 * relances sans réponse fixé dans les paramètres, le lead revient au
 * responsable commercial (circuit 1 : réattribution ou clôture) ou attend la
 * décision de l'Office Manager (circuit 2).
 */
export async function recordFollowUp(
  id: string,
  input: { type: 'CALL' | 'EMAIL' | 'MEETING'; content: string; answered: boolean; nextActionAt?: Date | null },
  actorId: string,
  scope?: StaffScope,
) {
  await assertLeadAccess(scope, id);
  const lead = await loadLead(id);
  assertOpen(lead);
  if (!PRE_VISIT_STAGES.includes(lead.stage)) throw ApiError.conflict('Les relances concernent les leads qui n’ont pas encore confirmé de visite.');
  const settings = await getSettings();
  const count = input.answered ? lead.followUpCount : lead.followUpCount + 1;
  const exhausted = !input.answered && count >= settings.followUpMaxAttempts;
  const nextActionAt = exhausted ? null : input.nextActionAt ?? new Date(Date.now() + settings.followUpIntervalDays * DAY);

  await prisma.lead.update({
    where: { id },
    data: {
      stage: 'FOLLOW_UP',
      followUpCount: count,
      nextActionAt,
      nextActionAlertedAt: null,
      dormantAlertedAt: null,
      ...(exhausted ? { followUpReturnedAt: new Date() } : {}),
    },
  });
  await logActivity(id, {
    type: input.type,
    content: `Relance${input.answered ? '' : ` sans réponse (${count}/${settings.followUpMaxAttempts})`} : ${input.content}`,
    authorId: actorId,
  });

  if (exhausted) {
    if (lead.circuit === 'SALES_TEAM') {
      await notifySalesManagers(lead, 'lead_returned', 'Lead revenu sans réponse', `— à réattribuer ou clôturer (${count} relances).`);
      await logActivity(id, { content: `${count} relances sans réponse : retour au responsable commercial (réattribution ou clôture).` });
    } else if (lead.assignedToId) {
      await notifyUsers([lead.assignedToId], 'lead_returned', 'Lead sans réponse', `${lead.reference} — ${lead.title} : ${count} relances sans réponse, à poursuivre ou clôturer.`, leadUrl(id));
      await logActivity(id, { content: `${count} relances sans réponse : décision de l’Office Manager attendue.` });
    }
  }
  return loadLead(id);
}

/** Visite, visio ou journée d'essai acceptée. En circuit 1, le dossier passe à l'Office Manager. */
export async function confirmVisit(
  id: string,
  input: { type: Extract<AppointmentType, 'VISIT' | 'VIDEO' | 'TRIAL_DAY'>; startAt: Date; endAt?: Date | null; location?: string | null; notes?: string | null; officeManagerId?: string | null },
  actorId: string,
  scope?: StaffScope,
) {
  await assertLeadAccess(scope, id);
  const lead = await loadLead(id);
  assertOpen(lead);
  if (!PRE_VISIT_STAGES.includes(lead.stage)) throw ApiError.conflict('La visite se confirme avant le devis.');
  if (!lead.assignedToId) throw ApiError.conflict('Attribuez ou prenez en charge ce lead d’abord.');

  const handover = lead.circuit === 'SALES_TEAM';
  const omId = handover ? await resolveOfficeManager(input.officeManagerId, actorId, Boolean(scope?.officeManager)) : lead.assignedToId;
  const now = new Date();

  await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: {
        stage: 'VISIT_CONFIRMED',
        followUpReturnedAt: null,
        nextActionAt: input.startAt,
        nextActionAlertedAt: null,
        ...(handover ? { assignedToId: omId, assignedAt: now, handedOverAt: now } : {}),
      },
    }),
    prisma.appointment.create({
      data: { leadId: id, type: input.type, startAt: input.startAt, endAt: input.endAt, location: input.location, notes: input.notes, assigneeId: omId },
    }),
  ]);

  const om = await prisma.user.findUnique({ where: { id: omId }, select: STAFF_SELECT });
  await logActivity(id, {
    content: `${APPOINTMENT_LABEL[input.type]} confirmé(e) le ${input.startAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}${handover && om ? ` — dossier transmis à ${staffName(om)}` : ''}.`,
    authorId: actorId,
  });
  if (handover && omId !== actorId) {
    await notifyUsers(
      [omId],
      'lead_handover',
      'Dossier transmis par le commercial',
      `${lead.reference} — ${lead.title} : ${APPOINTMENT_LABEL[input.type].toLowerCase()} le ${input.startAt.toLocaleDateString('fr-FR')}${lead.offerInterest ? `, offre pressentie ${lead.offerInterest}` : ''}.`,
      leadUrl(id),
    );
  }
  return loadLead(id);
}

// --- Clôture, réouverture --------------------------------------------------------

export async function loseLead(id: string, reason: string, actorId: string, scope?: StaffScope) {
  await assertLeadAccess(scope, id);
  const lead = await loadLead(id);
  assertOpen(lead);
  const updated = await prisma.lead.update({
    where: { id },
    data: { stage: 'LOST', lostAt: new Date(), lostReason: reason.trim(), nextActionAt: null, followUpReturnedAt: null },
  });
  await logActivity(id, { content: `Lead clôturé (${stageLabel(lead.stage, lead.circuit)} → Perdu). Motif : ${reason.trim()}`, authorId: actorId });
  return updated;
}

export async function reopenLead(id: string, actorId: string, scope?: StaffScope) {
  assertCanManage(scope);
  const lead = await loadLead(id);
  if (lead.stage !== 'LOST') throw ApiError.conflict('Seul un lead perdu se rouvre.');
  const updated = await prisma.lead.update({
    where: { id },
    data: { stage: lead.assignedToId ? 'ASSIGNED' : 'REGISTERED', lostAt: null, lostReason: null, followUpCount: 0 },
  });
  await logActivity(id, { content: 'Lead rouvert.', authorId: actorId });
  return updated;
}
