import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { sendEmail } from '../../lib/email';
import { generatePassword, sendCredentialsEmail } from '../../lib/account-provisioning';
import { env } from '../../config/env';
import { getSettings } from '../settings/settings.service';
import { approveAccount } from '../situation/situation.service';
import { logActivity, scheduleTask } from './leads.service';
import { STAFF_SELECT, notifyUsers, staffName } from './staff';
import { emailButton } from '../../lib/emailLayout';

// Activation du membre (phase 4 du processus v1.3), déclenchée par le
// paiement confirmé :
//   - la fiche lead devient la fiche membre : compte rattaché, ou créé avec ses
//     accès envoyés par e-mail si le client n'en avait pas ;
//   - l'espace membre se déverrouille (décision du 23/10/2026 : plus de
//     validation manuelle, c'est le paiement qui active le compte) ;
//   - un référent membre est désigné (l'Office Manager du dossier par défaut) ;
//   - à la première activation : kit de bienvenue par e-mail et appels de
//     check-in (J+7, M+1 — paramétrables) dans l'agenda du référent.

const DAY = 24 * 3600 * 1000;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

function splitName(contactName: string) {
  const parts = contactName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || 'Membre', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Compte membre du client d'un lead : celui déjà rattaché, celui qui porte son
 * e-mail, ou un nouveau compte (accès envoyés par e-mail). Sans e-mail sur la
 * fiche, rien n'est créé : l'équipe complète la fiche.
 */
export async function ensureMemberAccount(leadId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  if (lead.userId) return lead.userId;
  if (!lead.email) {
    await logActivity(leadId, { content: 'Paiement confirmé mais aucune adresse e-mail sur la fiche : complétez-la pour ouvrir l’espace du membre.' });
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email: lead.email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== 'MEMBER') return null;
    await prisma.lead.update({ where: { id: leadId }, data: { userId: existing.id } });
    return existing.id;
  }

  const site = await prisma.site.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!site) return null;
  const password = generatePassword();
  const { firstName, lastName } = splitName(lead.contactName);
  const user = await prisma.user.create({
    data: {
      email: lead.email,
      phone: lead.phone,
      passwordHash: await hashPassword(password),
      role: 'MEMBER',
      emailVerified: new Date(),
      profile: { create: { firstName, lastName, companyName: lead.companyName, siteId: site.id } },
    },
    select: { id: true },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { userId: user.id } });
  await logActivity(leadId, { content: `Espace membre créé pour ${lead.email} : ses accès lui sont envoyés par e-mail.` });
  sendCredentialsEmail({
    to: lead.email,
    name: firstName,
    password,
    loginPath: '/login',
    subject: 'IN NETWORK — Votre espace membre',
    intro: 'Votre paiement est confirmé : votre espace membre IN NETWORK est ouvert. Vous y suivez vos services, vos documents et vos échéances.',
  });
  return user.id;
}

function welcomeKitHtml(firstName: string, referentName: string | null) {
  const link = (path: string, label: string) => `<a href="${env.appUrl}${path}">${label}</a>`;
  return [
    `<p>Bonjour ${escapeHtml(firstName)},</p>`,
    '<p>Bienvenue dans la communauté IN NETWORK ! Votre paiement est confirmé et votre espace membre est entièrement actif.</p>',
    referentName ? `<p>Votre référent, <strong>${escapeHtml(referentName)}</strong>, est votre interlocuteur unique : il suit la mise en place de vos services et reste à votre écoute jusqu’au renouvellement.</p>` : '',
    '<p>Pour bien démarrer :</p>',
    '<ul>',
    `<li>${link('/dashboard/services', 'Mes services')} : l’avancement de chaque service, ses dates et ses documents ;</li>`,
    `<li>${link('/evenements', 'Le calendrier des événements')} : workshops, portes ouvertes, IN Talk ;</li>`,
    `<li>${link('/annuaire', 'L’annuaire des membres')}, après avoir complété votre profil ;</li>`,
    `<li>${link('/services', 'Les tarifs des services')}, pour demander un service supplémentaire depuis votre espace.</li>`,
    '</ul>',
    emailButton('Accéder à mon espace', `${env.appUrl}/dashboard`),
    '<p>Nous vous appellerons dans quelques jours pour faire le point.</p>',
    '<p>À très vite,<br>L’équipe IN NETWORK</p>',
  ].join('');
}

/**
 * Active le membre à son paiement. Idempotent : le kit de bienvenue et les
 * check-ins ne partent qu'à la première activation.
 */
export async function activateMember(userId: string, leadId: string, actorId: string | null) {
  const [user, lead] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { referentId: true, email: true, profile: { select: { firstName: true, isPublic: true } } } }),
    prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true, assignedTo: { select: { role: true } } } }),
  ]);
  if (!user) return;
  const firstActivation = !user.profile?.isPublic;

  // Référent : l'Office Manager du dossier, sinon la personne qui enregistre le paiement.
  let referentId = user.referentId;
  if (!referentId) {
    referentId = lead?.assignedToId ?? actorId;
    if (referentId) await prisma.user.update({ where: { id: userId }, data: { referentId } });
  }
  const referent = referentId ? await prisma.user.findUnique({ where: { id: referentId }, select: STAFF_SELECT }) : null;

  if (user.profile) await approveAccount(userId, actorId ?? referentId ?? userId, { silent: firstActivation });
  if (!firstActivation) return;

  if (referent) {
    await logActivity(leadId, { content: `Membre activé — référent : ${staffName(referent)}. Kit de bienvenue envoyé.`, authorId: actorId });
    await notifyUsers([userId], 'referent_assigned', 'Votre référent', `${staffName(referent)} est votre interlocuteur IN NETWORK, de l’activation au renouvellement.`, '/dashboard');
  }
  sendEmail({
    to: user.email,
    subject: 'Bienvenue chez IN NETWORK',
    html: welcomeKitHtml(user.profile?.firstName ?? '', referent ? staffName(referent) : null),
  }).catch((err) => console.error('[activation] échec du kit de bienvenue', err));

  const { checkInDays } = await getSettings();
  for (const days of checkInDays) {
    await scheduleTask(leadId, {
      startAt: new Date(Date.now() + days * DAY),
      assigneeId: referentId,
      notes: `Check-in J+${days} avec le membre : accès, services, présentation aux autres membres, prochains événements.`,
    });
  }
}
