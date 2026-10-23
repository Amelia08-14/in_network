import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { env } from '../../config/env';
import { getSettings } from '../settings/settings.service';
import { logActivity } from './leads.service';
import { formatAmount } from './money';
import { invoiceNumberLabel, invoicePdf } from './invoices.service';
import { quotePdf } from './quotes.service';
import { listStaffByRole, listStaffWith, notifyUsers } from './staff';
import { OPEN_STAGES } from './workflow';

// Automatisations commerciales — exécutées chaque heure (cron, cf. server.ts)
// et à la demande depuis le tableau de bord CRM. Chaque règle est idempotente :
// elle note ce qu'elle a déjà fait (dates de relance, compteurs) pour ne jamais
// notifier ni écrire au client en boucle. Les délais du processus v1.3
// (alertes d'échéance, délai de grâce, protection des leads) se règlent dans
// les paramètres (settings.service.ts).

export const AUTOMATION_RULES = {
  quoteReminderEveryDays: 3,
  quoteMaxReminders: 2,
  invoiceReminderEveryDays: 7,
  invoiceMaxReminders: 3,
  dormantLeadAfterDays: 7,
  appointmentReminderHours: 24,
} as const;

const DAY = 24 * 3600 * 1000;
const OPEN = OPEN_STAGES;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export interface AutomationResult {
  quotesExpired: number;
  quoteReminders: number;
  invoiceReminders: number;
  followUpAlerts: number;
  dormantAlerts: number;
  appointmentReminders: number;
  expiryAlerts: number;
  servicesExpired: number;
  protectionAlerts: number;
}

export async function runAutomations(now = new Date()): Promise<AutomationResult> {
  const result: AutomationResult = {
    quotesExpired: 0,
    quoteReminders: 0,
    invoiceReminders: 0,
    followUpAlerts: 0,
    dormantAlerts: 0,
    appointmentReminders: 0,
    expiryAlerts: 0,
    servicesExpired: 0,
    protectionAlerts: 0,
  };
  // Sans commercial assigné (lead à qualifier / à assigner), l'alerte va aux comptes qui
  // gèrent les leads (responsable commercial…), pas à toute l'équipe.
  const crmStaff = (await listStaffWith('crm_manage')).map((u) => u.id);
  const audience = (assigneeId: string | null | undefined) => (assigneeId ? [assigneeId] : crmStaff);

  // 1. Devis dont la validité est dépassée → expirés.
  const expired = await prisma.quote.findMany({
    where: { status: 'SENT', validUntil: { lt: now } },
    include: { lead: { select: { id: true, assignedToId: true } } },
  });
  for (const quote of expired) {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } });
    await logActivity(quote.leadId, { content: `Devis ${quote.number} expiré (validité dépassée).` });
    await notifyUsers(audience(quote.lead.assignedToId), 'quote_expired', 'Devis expiré', `${quote.number} n'a pas reçu de réponse avant la fin de sa validité.`);
    result.quotesExpired += 1;
  }

  // 2. Relance automatique des devis sans réponse (email au client + alerte commercial).
  const quotes = await prisma.quote.findMany({
    where: { status: 'SENT', reminderCount: { lt: AUTOMATION_RULES.quoteMaxReminders }, sentAt: { not: null } },
    include: { lead: { select: { id: true, email: true, contactName: true, assignedToId: true } } },
  });
  for (const quote of quotes) {
    const reference = quote.lastReminderAt ?? quote.sentAt!;
    if (now.getTime() - reference.getTime() < AUTOMATION_RULES.quoteReminderEveryDays * DAY) continue;

    let emailed = false;
    if (quote.lead.email) {
      try {
        const { buffer } = await quotePdf(quote.id);
        await sendEmail({
          to: quote.lead.email,
          subject: `Relance — votre devis ${quote.number}`,
          html: [
            `<p>Bonjour ${escapeHtml(quote.lead.contactName)},</p>`,
            `<p>Nous nous permettons de revenir vers vous au sujet de notre devis <strong>${quote.number}</strong> (${formatAmount(Number(quote.total))} TTC), joint à nouveau à ce message.</p>`,
            '<p>Avez-vous pu l’étudier ? Nous restons à votre disposition pour en discuter ou l’ajuster.</p>',
            '<p>L’équipe IN NETWORK</p>',
          ].join(''),
          attachments: [{ filename: `${quote.number}.pdf`, content: buffer }],
        });
        emailed = true;
      } catch (err) {
        console.error('[automations] relance devis impossible', err);
      }
    }
    await prisma.quote.update({ where: { id: quote.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
    await logActivity(quote.leadId, {
      content: `Relance automatique n°${quote.reminderCount + 1} du devis ${quote.number}${emailed ? ` envoyée à ${quote.lead.email}` : ' : pas d’email envoyé, à relancer par téléphone'}.`,
    });
    await notifyUsers(audience(quote.lead.assignedToId), 'quote_reminder', 'Devis sans réponse', `${quote.number} attend une réponse de ${quote.lead.contactName}.`);
    result.quoteReminders += 1;
  }

  // 3. Factures émises et échues → rappel de paiement.
  const invoices = await prisma.invoice.findMany({
    where: { status: 'SENT', dueDate: { lt: now }, reminderCount: { lt: AUTOMATION_RULES.invoiceMaxReminders } },
    include: { lead: { select: { assignedToId: true } } },
  });
  for (const invoice of invoices) {
    const reference = invoice.lastReminderAt ?? invoice.dueDate!;
    if (now.getTime() - reference.getTime() < AUTOMATION_RULES.invoiceReminderEveryDays * DAY) continue;

    let emailed = false;
    if (invoice.customerEmail) {
      try {
        const { buffer } = await invoicePdf(invoice.id);
        const number = invoiceNumberLabel(invoice);
        await sendEmail({
          to: invoice.customerEmail,
          subject: `Rappel de paiement — ${number}`,
          html: [
            `<p>Bonjour ${escapeHtml(invoice.customerName)},</p>`,
            `<p>Sauf erreur de notre part, la facture proforma <strong>${number}</strong> (${formatAmount(Number(invoice.total))} TTC) à régler avant le ${invoice.dueDate!.toLocaleDateString('fr-FR')} n’a pas encore été payée. Elle est jointe à ce message.</p>`,
            '<p>Si le règlement est déjà parti, déposez simplement votre justificatif dans votre espace IN NETWORK.</p>',
            '<p>L’équipe IN NETWORK</p>',
          ].join(''),
          attachments: [{ filename: `${number}.pdf`, content: buffer }],
        });
        emailed = true;
      } catch (err) {
        console.error('[automations] rappel facture impossible', err);
      }
    }
    await prisma.invoice.update({ where: { id: invoice.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
    if (invoice.leadId) {
      await logActivity(invoice.leadId, {
        content: `Rappel de paiement automatique n°${invoice.reminderCount + 1} pour ${invoiceNumberLabel(invoice)}${emailed ? ` envoyé à ${invoice.customerEmail}` : ' (pas d’email envoyé)'}.`,
      });
    }
    await notifyUsers(audience(invoice.lead?.assignedToId ?? invoice.createdById), 'invoice_overdue', 'Proforma impayée', `${invoiceNumberLabel(invoice)} (${invoice.customerName}) est échue et non réglée.`);
    result.invoiceReminders += 1;
  }

  // 4. Actions à mener arrivées à échéance (nextActionAt).
  const due = await prisma.lead.findMany({
    where: { stage: { in: [...OPEN] }, nextActionAt: { lte: now } },
  });
  for (const lead of due) {
    if (lead.nextActionAlertedAt && lead.nextActionAlertedAt >= lead.nextActionAt!) continue;
    await prisma.lead.update({ where: { id: lead.id }, data: { nextActionAlertedAt: now } });
    await notifyUsers(audience(lead.assignedToId), 'lead_followup_due', 'Action à mener', `${lead.reference} — ${lead.title} : l'action prévue est arrivée à échéance.`, `/admin/crm/leads/${lead.id}`);
    result.followUpAlerts += 1;
  }

  // 5. Leads dormants : aucune activité depuis N jours.
  const dormantBefore = new Date(now.getTime() - AUTOMATION_RULES.dormantLeadAfterDays * DAY);
  const dormant = await prisma.lead.findMany({
    where: {
      stage: { in: [...OPEN] },
      updatedAt: { lte: dormantBefore },
      OR: [{ dormantAlertedAt: null }, { dormantAlertedAt: { lte: dormantBefore } }],
    },
  });
  for (const lead of dormant) {
    await prisma.lead.update({ where: { id: lead.id }, data: { dormantAlertedAt: now } });
    await notifyUsers(audience(lead.assignedToId), 'lead_dormant', 'Lead sans activité', `${lead.reference} — ${lead.title} n'a pas bougé depuis ${AUTOMATION_RULES.dormantLeadAfterDays} jours.`, `/admin/crm/leads/${lead.id}`);
    result.dormantAlerts += 1;
  }

  // 6. Rendez-vous dans les prochaines 24 h.
  const soon = new Date(now.getTime() + AUTOMATION_RULES.appointmentReminderHours * 3600 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: { status: 'SCHEDULED', reminderSentAt: null, startAt: { gt: now, lte: soon } },
    include: { lead: { select: { reference: true, title: true } } },
  });
  for (const appointment of appointments) {
    await prisma.appointment.update({ where: { id: appointment.id }, data: { reminderSentAt: now } });
    await notifyUsers(
      audience(appointment.assigneeId),
      'appointment_reminder',
      'Rendez-vous à venir',
      `${appointment.lead.reference} — ${appointment.lead.title} : ${appointment.startAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}.`,
    );
    result.appointmentReminders += 1;
  }

  const settings = await getSettings();

  // 7. Échéance des services du panier : alertes à J-60, J-30, J-7 (paramétrables)
  //    au membre (bouton « Renouveler ») et à son référent.
  const [first, second, third] = [...settings.expiryAlertDays].sort((a, b) => b - a);
  const slots = [
    { days: first, field: 'alert60At' as const },
    { days: second, field: 'alert30At' as const },
    { days: third, field: 'alert7At' as const },
  ].filter((slot) => slot.days !== undefined);
  for (const slot of slots) {
    const orders = await prisma.serviceOrder.findMany({
      where: { status: 'DONE', renewedBy: null, expiredAt: null, [slot.field]: null, expiresAt: { gt: now, lte: new Date(now.getTime() + slot.days * DAY) } },
      include: { user: { select: { id: true, email: true, referentId: true, profile: { select: { firstName: true } } } } },
    });
    for (const order of orders) {
      await prisma.serviceOrder.update({ where: { id: order.id }, data: { [slot.field]: now } });
      const left = Math.max(1, Math.ceil((order.expiresAt!.getTime() - now.getTime()) / DAY));
      const when = order.expiresAt!.toLocaleDateString('fr-FR');
      if (order.user) {
        await notifyUsers([order.user.id], 'service_expiring', `Échéance dans ${left} jour${left > 1 ? 's' : ''}`, `${order.title} arrive à échéance le ${when}. Renouvelez-le en un clic depuis « Mes services ».`, '/dashboard/services');
        sendEmail({
          to: order.user.email,
          subject: `IN NETWORK — ${order.title} arrive à échéance le ${when}`,
          html: [
            `<p>Bonjour ${escapeHtml(order.user.profile?.firstName ?? '')},</p>`,
            `<p>Votre service <strong>${escapeHtml(order.title)}</strong> arrive à échéance le <strong>${when}</strong>.</p>`,
            `<p>Pour le prolonger sans interruption, demandez son renouvellement depuis votre espace : <a href="${env.appUrl}/dashboard/services">Mes services</a>.</p>`,
            '<p>L’équipe IN NETWORK</p>',
          ].join(''),
        }).catch((err) => console.error('[automations] alerte d’échéance non envoyée', err));
      }
      const referent = order.user?.referentId ?? order.assignedToId;
      if (referent) await notifyUsers([referent], 'service_expiring_staff', 'Échéance à relancer', `${order.title} (${order.user?.email ?? 'membre'}) arrive à échéance le ${when}.`, `/admin/lancements?order=${order.id}`);
      if (order.leadId) await logActivity(order.leadId, { content: `Alerte d’échéance J-${slot.days} envoyée pour ${order.title}.` });
      result.expiryAlerts += 1;
    }
  }

  // 8. Échéance dépassée (après le délai de grâce) : le service passe « Expiré ».
  const graceLimit = new Date(now.getTime() - settings.expiryGraceDays * DAY);
  const expiredOrders = await prisma.serviceOrder.findMany({
    where: { status: 'DONE', renewedBy: null, expiredAt: null, expiresAt: { lt: graceLimit } },
    include: { user: { select: { id: true, referentId: true } } },
  });
  const oms = expiredOrders.length ? (await listStaffByRole('OFFICE_MANAGER')).map((u) => u.id) : [];
  for (const order of expiredOrders) {
    await prisma.serviceOrder.update({ where: { id: order.id }, data: { expiredAt: now } });
    if (order.subscriptionId) await prisma.subscription.updateMany({ where: { id: order.subscriptionId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
    if (order.user) await notifyUsers([order.user.id], 'service_expired', 'Service expiré', `${order.title} est arrivé à échéance. Vous pouvez le renouveler depuis « Mes services ».`, '/dashboard/services');
    await notifyUsers([order.user?.referentId, ...oms].filter((u): u is string => Boolean(u)), 'service_expired_staff', 'Service expiré', order.title, `/admin/lancements?order=${order.id}`);
    if (order.leadId) await logActivity(order.leadId, { content: `${order.title} : échéance dépassée, service expiré.` });
    result.servicesExpired += 1;
  }

  // 9. Protection d'un lead de la Sales Team (si la durée est fixée) : sans
  //    activité au-delà, le responsable commercial est prévenu (réattribution).
  if (settings.leadProtectionDays) {
    const limit = new Date(now.getTime() - settings.leadProtectionDays * DAY);
    const unprotected = await prisma.lead.findMany({
      where: { circuit: 'SALES_TEAM', handedOverAt: null, stage: { in: ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP'] }, updatedAt: { lte: limit }, followUpReturnedAt: null },
    });
    for (const lead of unprotected) {
      await prisma.lead.update({ where: { id: lead.id }, data: { followUpReturnedAt: now } });
      await logActivity(lead.id, { content: `Aucune activité depuis ${settings.leadProtectionDays} jours : fin de la protection, retour au responsable commercial.` });
      await notifyUsers(crmStaff, 'lead_protection', 'Protection du lead échue', `${lead.reference} — ${lead.title} : à réattribuer ou clôturer.`, `/admin/crm/leads/${lead.id}`);
      result.protectionAlerts += 1;
    }
  }

  return result;
}
