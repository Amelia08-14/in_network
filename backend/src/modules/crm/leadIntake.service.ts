import type { Lead } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { requestLabel } from '../services/requestLabel';
import { describeAttribution, leadOriginFields, type Attribution } from './attribution';
import { isAccountValidated } from '../situation/accountState';
import { findOpenDuplicate, logActivity, notifyDispatchers } from './leads.service';
import { nextNumber } from './numbering';
import { createQuote, sendQuote } from './quotes.service';
import { listStaffByRole, notifyUsers } from './staff';

// Leads créés automatiquement (phase 1 du processus v1.3) : inscription,
// demande de devis du site, formulaire de contact, recommandation d'un membre,
// formulaires publicitaires des réseaux (webhook) — et, depuis l'espace
// membre, les demandes de services supplémentaires (lead « Extension »)
// rattachées à la fiche du membre. L'origine du visiteur (lien de campagne,
// réseau social, cf. attribution.ts) fixe le canal du lead.
// « Un contact, une fiche » : un contact déjà suivi n'ouvre pas de second lead,
// la nouvelle demande est versée à sa fiche existante.

const leadUrl = (id: string) => `/admin/crm/leads/${id}`;

/**
 * Contact déjà suivi qui revient par une campagne : on précise son canal s'il
 * n'était connu que comme « Site web » (première origine identifiée conservée).
 */
async function refineOrigin(leadId: string, attribution: Attribution | null | undefined) {
  const origin = leadOriginFields(attribution);
  if (origin.channel === 'WEBSITE') return;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { channel: true } });
  if (lead && (!lead.channel || lead.channel === 'WEBSITE')) {
    await prisma.lead.update({ where: { id: leadId }, data: origin });
  }
  await logActivity(leadId, { content: `Origine : ${describeAttribution(attribution)}.` });
}

async function logOrigin(leadId: string, attribution: Attribution | null | undefined) {
  const described = describeAttribution(attribution);
  if (described) await logActivity(leadId, { content: `Origine : ${described}.` });
}

/** Dernière fiche gagnée du membre : la fiche membre à laquelle se rattachent ses extensions. */
export async function memberLeadOf(userId: string) {
  return prisma.lead.findFirst({ where: { userId, stage: 'PAID' }, orderBy: [{ kind: 'asc' }, { wonAt: 'asc' }] });
}

/** Intervenant d'un membre : son référent, sinon celui de sa fiche, sinon l'unique Office Manager. */
async function memberOwner(userId: string, parent: Lead | null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referentId: true } });
  if (user?.referentId) return user.referentId;
  if (parent?.assignedToId) return parent.assignedToId;
  const oms = await listStaffByRole('OFFICE_MANAGER');
  return oms.length === 1 ? oms[0].id : null;
}

/**
 * Lead « Extension » ou « Renouvellement » d'un membre, traité par son
 * référent et l'Office Manager. Il garde le circuit de la fiche d'origine (le
 * responsable commercial voit ainsi les extensions de ses clients) mais il est
 * d'emblée entre les mains de l'Office Manager (transmis).
 */
export async function createMemberLead(
  userId: string,
  input: { kind: 'EXTENSION' | 'RENEWAL'; title: string; serviceRequestId?: string; expectedAmount?: number | null; notes?: string | null },
) {
  const [parent, user] = await Promise.all([
    memberLeadOf(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, profile: { select: { firstName: true, lastName: true, companyName: true } }, company: { select: { name: true } } } }),
  ]);
  const ownerId = await memberOwner(userId, parent);
  const now = new Date();
  const contactName = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : user?.email ?? 'Membre';
  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: input.title,
      contactName,
      email: user?.email,
      phone: user?.phone,
      companyName: user?.company?.name ?? user?.profile?.companyName ?? null,
      source: 'MEMBER_SPACE',
      kind: input.kind,
      pipeline: parent?.pipeline ?? null,
      channel: parent?.channel ?? null,
      circuit: ownerId ? parent?.circuit ?? 'OFFICE_MANAGER' : null,
      dispatchedAt: ownerId ? now : null,
      salesAgentId: parent?.circuit === 'SALES_TEAM' ? parent.salesAgentId : null,
      assignedToId: ownerId,
      assignedAt: ownerId ? now : null,
      handedOverAt: ownerId && parent?.circuit === 'SALES_TEAM' ? now : null,
      stage: ownerId ? 'QUALIFIED' : 'REGISTERED',
      qualifiedAt: ownerId ? now : null,
      expectedAmount: input.expectedAmount,
      notes: input.notes,
      userId,
      parentLeadId: parent?.id ?? null,
      serviceRequestId: input.serviceRequestId,
    },
  });
  await logActivity(lead.id, {
    content: `${input.kind === 'RENEWAL' ? 'Demande de renouvellement' : 'Demande de service supplémentaire'} envoyée par le membre depuis son espace${parent ? ` (fiche ${parent.reference})` : ''}.`,
  });
  if (ownerId) {
    await notifyUsers([ownerId], 'lead_member_request', input.kind === 'RENEWAL' ? 'Renouvellement demandé' : 'Service supplémentaire demandé', `${lead.reference} — ${lead.title} (${contactName})`, leadUrl(lead.id));
  } else {
    await notifyDispatchers(lead, input.kind === 'RENEWAL' ? 'Renouvellement à traiter' : 'Demande d’un membre à traiter', `(${contactName})`);
  }
  return lead;
}

/**
 * Tarif défini : le devis est généré et envoyé par la plateforme, sans attendre
 * l'équipe. Une ligne sans prix ou un devis à valider reste en brouillon pour
 * l'intervenant (qui est prévenu).
 */
export async function autoQuote(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, reference: true, title: true, assignedToId: true } });
  if (!lead) return null;
  try {
    const quote = await createQuote({ leadId }, lead.assignedToId);
    try {
      await sendQuote(quote.id, lead.assignedToId);
      return quote;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'envoi impossible';
      await logActivity(leadId, { content: `Devis ${quote.number} préparé automatiquement, à finaliser : ${reason}` });
      if (lead.assignedToId) {
        await notifyUsers([lead.assignedToId], 'quote_to_finalize', 'Devis à finaliser', `${quote.number} (${lead.reference}) : ${reason}`, `/admin/devis/${quote.id}`);
      }
      return quote;
    }
  } catch (err) {
    console.error('[crm] devis automatique non créé', err);
    return null;
  }
}

/** Demande de devis du site ou de l'espace membre (panier). */
export async function createLeadFromServiceRequest(requestId: string, attribution?: Attribution) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      items: true,
      user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true, companyName: true } } } },
    },
  });
  if (!request || request.items.length === 0) return null;

  const priced = request.items.reduce((sum, item) => sum + (item.unitPrice ? Number(item.unitPrice) : 0), 0);
  const title = requestLabel(request.items);

  // Membre actif : c'est une extension de sa fiche membre, avec devis automatique.
  if (request.userId && (await isAccountValidated(request.userId))) {
    const lead = await createMemberLead(request.userId, { kind: 'EXTENSION', title, serviceRequestId: request.id, expectedAmount: priced || null, notes: request.notes });
    if (lead.assignedToId) await autoQuote(lead.id);
    return lead;
  }

  const profile = request.user?.profile;
  const contactName = (profile && `${profile.firstName} ${profile.lastName}`.trim()) || request.user?.email || request.guestName || 'Contact du site';
  const email = request.user?.email ?? request.guestEmail;
  const phone = request.user?.phone ?? request.guestPhone;

  // Contact déjà suivi (son inscription, une demande précédente…) : la demande rejoint sa fiche.
  const existing = await findOpenDuplicate({ email, phone });
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { serviceRequestId: request.id, expectedAmount: priced > 0 ? priced : undefined, userId: request.userId ?? undefined, updatedAt: new Date() },
    });
    await logActivity(existing.id, { content: `Nouvelle demande de devis du site : ${title}.` });
    await refineOrigin(existing.id, attribution);
    if (existing.assignedTo) {
      await notifyUsers([existing.assignedTo.id], 'lead_request', 'Nouvelle demande de devis', `${existing.reference} — ${title}`, leadUrl(existing.id));
    } else {
      await notifyDispatchers(existing, 'Nouvelle demande de devis', `— ${title}`);
    }
    return prisma.lead.findUnique({ where: { id: existing.id } });
  }

  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title,
      contactName,
      email,
      phone,
      companyName: profile?.companyName ?? request.guestCompany,
      source: 'WEBSITE_QUOTE',
      ...leadOriginFields(attribution),
      expectedAmount: priced > 0 ? priced : null,
      notes: request.notes,
      userId: request.userId,
      serviceRequestId: request.id,
    },
  });
  await logActivity(lead.id, {
    content: `Lead créé automatiquement depuis la demande de devis du site (${request.items.length} ligne${request.items.length > 1 ? 's' : ''}).`,
  });
  await logOrigin(lead.id, attribution);
  await notifyDispatchers(lead, 'Nouveau lead à aiguiller', `(${contactName}) vient d'arriver depuis le site.`);
  return lead;
}

/** Nouvelle inscription : lead à aiguiller (ou rattachement au lead déjà ouvert pour ce contact). */
export async function createLeadFromRegistration(userId: string, attribution?: Attribution) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, company: { select: { name: true, seatLimit: true } } },
  });
  if (!user) return null;

  const existing = await findOpenDuplicate({ email: user.email, phone: user.phone });
  if (existing) {
    await prisma.lead.updateMany({ where: { email: user.email, userId: null }, data: { userId } });
    await logActivity(existing.id, { content: 'Le contact a créé son compte sur le site : sa fiche est rattachée à son espace.' });
    await refineOrigin(existing.id, attribution);
    return prisma.lead.findUnique({ where: { id: existing.id } });
  }

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
      ...leadOriginFields(attribution),
      notes: user.company ? `Compte entreprise : ${user.company.seatLimit} poste(s) demandé(s).` : null,
      userId,
    },
  });
  await logActivity(lead.id, { content: 'Lead créé automatiquement à l’inscription : l’espace du membre s’ouvrira à son premier paiement.' });
  await logOrigin(lead.id, attribution);
  await prisma.lead.updateMany({ where: { email: user.email, userId: null }, data: { userId } });
  await notifyDispatchers(lead, 'Nouvelle inscription à aiguiller', `— ${contactName}${companyName ? ` (${companyName})` : ''} vient de créer un compte.`);
  return lead;
}

/** Formulaire /contact. */
export async function createLeadFromContactMessage(messageId: string, attribution?: Attribution) {
  const message = await prisma.contactMessage.findUnique({ where: { id: messageId } });
  if (!message) return null;

  const existing = await findOpenDuplicate({ email: message.email });
  if (existing) {
    await logActivity(existing.id, { type: 'EMAIL', content: `Nouveau message via le formulaire de contact${message.subject ? ` (${message.subject})` : ''} : ${message.message.slice(0, 500)}` });
    const linked = await prisma.lead.findUnique({ where: { id: existing.id }, select: { contactMessageId: true } });
    if (!linked?.contactMessageId) await prisma.lead.update({ where: { id: existing.id }, data: { contactMessageId: message.id } });
    await refineOrigin(existing.id, attribution);
    if (existing.assignedTo) await notifyUsers([existing.assignedTo.id], 'lead_message', 'Nouveau message du contact', `${existing.reference} — ${existing.title}`, leadUrl(existing.id));
    return prisma.lead.findUnique({ where: { id: existing.id } });
  }

  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: message.subject ? `${message.subject} — ${message.name}` : `Message de contact — ${message.name}`,
      contactName: message.name,
      email: message.email,
      phone: message.phone,
      source: 'CONTACT_FORM',
      ...leadOriginFields(attribution),
      notes: message.message,
      contactMessageId: message.id,
    },
  });
  await logActivity(lead.id, { content: 'Lead créé automatiquement depuis le formulaire de contact.' });
  await logOrigin(lead.id, attribution);
  await notifyDispatchers(lead, 'Nouveau lead à aiguiller', `— message de ${message.name} reçu via le formulaire de contact.`);
  return lead;
}

/** Recommandation d'un contact par un membre (parrainage, pipeline Événements et communauté). */
export async function createReferralLead(
  referrerId: string,
  input: { contactName: string; email?: string | null; phone?: string | null; companyName?: string | null; need?: string | null },
) {
  const referrer = await prisma.user.findUnique({ where: { id: referrerId }, select: { email: true, profile: { select: { firstName: true, lastName: true } } } });
  const referrerName = referrer?.profile ? `${referrer.profile.firstName} ${referrer.profile.lastName}`.trim() : referrer?.email ?? 'un membre';

  const existing = await findOpenDuplicate(input);
  if (existing) {
    await logActivity(existing.id, { content: `Contact également recommandé par ${referrerName}.` });
    return { lead: existing, alreadyKnown: true };
  }
  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: `Recommandation — ${input.contactName}`,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      notes: input.need,
      source: 'MEMBER_REFERRAL',
      pipeline: 'COMMUNITY',
      channel: 'MEMBER_REFERRAL',
      channelDetail: referrerName,
      referrerUserId: referrerId,
    },
  });
  await logActivity(lead.id, { content: `Contact recommandé par le membre ${referrerName} depuis son espace.` });
  await notifyDispatchers(lead, 'Nouvelle recommandation à aiguiller', `— recommandé par ${referrerName}.`);
  return { lead, alreadyKnown: false };
}

// --- Formulaires publicitaires des réseaux (webhook) ------------------------------

export interface AdFormLead {
  /** Réseau d'origine : facebook, instagram, linkedin, tiktok… */
  platform: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  message?: string | null;
  campaign?: string | null;
  form?: string | null;
  ad?: string | null;
  /** Autres réponses du formulaire, reprises telles quelles dans les notes. */
  answers?: Record<string, string>;
}

/**
 * Lead reçu d'un formulaire publicitaire (Facebook / Instagram Lead Ads,
 * LinkedIn Lead Gen…) via Make ou Zapier. Il arrive « à aiguiller » avec son
 * canal (LinkedIn, ou Publicité pour les autres réseaux) et sa campagne ; un
 * contact déjà suivi n'ouvre pas de seconde fiche.
 */
export async function createLeadFromAdForm(input: AdFormLead) {
  const attribution: Attribution = { source: input.platform, medium: 'leadads', campaign: input.campaign ?? undefined };
  const origin = leadOriginFields(attribution);
  const detail = [origin.channelDetail, input.form ? `formulaire ${input.form}` : null].filter(Boolean).join(' · ').slice(0, 190);
  const answers = Object.entries(input.answers ?? {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${key} : ${value}`);
  const notes = [input.message, input.ad ? `Annonce : ${input.ad}` : null, ...answers].filter(Boolean).join('\n') || null;

  const existing = await findOpenDuplicate({ email: input.email, phone: input.phone });
  if (existing) {
    await logActivity(existing.id, { content: `Nouveau formulaire publicitaire reçu (${detail})${notes ? ` :\n${notes}` : '.'}` });
    await refineOrigin(existing.id, attribution);
    if (existing.assignedTo) {
      await notifyUsers([existing.assignedTo.id], 'lead_ad_form', 'Le contact a rempli un formulaire publicitaire', `${existing.reference} — ${existing.title}`, leadUrl(existing.id));
    }
    return { lead: existing, duplicate: true };
  }

  const lead = await prisma.lead.create({
    data: {
      reference: await nextNumber('LD'),
      title: `Formulaire ${origin.channelDetail?.split(' · ')[0] ?? input.platform} — ${input.contactName}`.slice(0, 190),
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      notes,
      source: 'AD_FORM',
      channel: origin.channel,
      pipeline: origin.pipeline,
      channelDetail: detail || origin.channelDetail,
    },
  });
  await logActivity(lead.id, { content: `Lead reçu automatiquement d’un formulaire publicitaire (${detail}).` });
  await notifyDispatchers(lead, 'Nouveau lead des réseaux à aiguiller', `— ${detail}.`);
  return { lead, duplicate: false };
}
