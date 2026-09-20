import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { logActivity } from './leads.service';
import { formatAmount } from './money';
import { invoicePdf } from './invoices.service';
import { quotePdf } from './quotes.service';
import { listStaffWith, notifyUsers } from './staff';

// Automatisations commerciales — exécutées chaque heure (cron, cf. server.ts)
// et à la demande depuis le tableau de bord CRM. Chaque règle est idempotente :
// elle note ce qu'elle a déjà fait (dates de relance, compteurs) pour ne jamais
// notifier ni écrire au client en boucle.

export const AUTOMATION_RULES = {
  quoteReminderEveryDays: 3,
  quoteMaxReminders: 2,
  invoiceReminderEveryDays: 7,
  invoiceMaxReminders: 3,
  dormantLeadAfterDays: 7,
  appointmentReminderHours: 24,
} as const;

const DAY = 24 * 3600 * 1000;
const OPEN = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_SENT'] as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export interface AutomationResult {
  quotesExpired: number;
  quoteReminders: number;
  invoiceReminders: number;
  followUpAlerts: number;
  dormantAlerts: number;
  appointmentReminders: number;
}

export async function runAutomations(now = new Date()): Promise<AutomationResult> {
  const result: AutomationResult = {
    quotesExpired: 0,
    quoteReminders: 0,
    invoiceReminders: 0,
    followUpAlerts: 0,
    dormantAlerts: 0,
    appointmentReminders: 0,
  };
  const crmStaff = (await listStaffWith('crm')).map((u) => u.id);
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
        await sendEmail({
          to: invoice.customerEmail,
          subject: `Rappel de paiement — facture ${invoice.number}`,
          html: [
            `<p>Bonjour ${escapeHtml(invoice.customerName)},</p>`,
            `<p>Sauf erreur de notre part, la facture <strong>${invoice.number}</strong> (${formatAmount(Number(invoice.total))} TTC) échue le ${invoice.dueDate!.toLocaleDateString('fr-FR')} n’a pas encore été réglée. Elle est jointe à ce message.</p>`,
            '<p>Si le règlement est déjà parti, merci de ne pas tenir compte de ce rappel.</p>',
            '<p>L’équipe IN NETWORK</p>',
          ].join(''),
          attachments: [{ filename: `${invoice.number}.pdf`, content: buffer }],
        });
        emailed = true;
      } catch (err) {
        console.error('[automations] rappel facture impossible', err);
      }
    }
    await prisma.invoice.update({ where: { id: invoice.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
    if (invoice.leadId) {
      await logActivity(invoice.leadId, {
        content: `Rappel de paiement automatique n°${invoice.reminderCount + 1} pour la facture ${invoice.number}${emailed ? ` envoyé à ${invoice.customerEmail}` : ' (pas d’email envoyé)'}.`,
      });
    }
    await notifyUsers(audience(invoice.lead?.assignedToId ?? invoice.createdById), 'invoice_overdue', 'Facture impayée', `${invoice.number} (${invoice.customerName}) est échue et non réglée.`);
    result.invoiceReminders += 1;
  }

  // 4. Actions à mener arrivées à échéance (nextActionAt).
  const due = await prisma.lead.findMany({
    where: { stage: { in: [...OPEN] }, nextActionAt: { lte: now } },
  });
  for (const lead of due) {
    if (lead.nextActionAlertedAt && lead.nextActionAlertedAt >= lead.nextActionAt!) continue;
    await prisma.lead.update({ where: { id: lead.id }, data: { nextActionAlertedAt: now } });
    await notifyUsers(audience(lead.assignedToId), 'lead_followup_due', 'Action à mener', `${lead.reference} — ${lead.title} : l'action prévue est arrivée à échéance.`);
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
    await notifyUsers(audience(lead.assignedToId), 'lead_dormant', 'Lead sans activité', `${lead.reference} — ${lead.title} n'a pas bougé depuis ${AUTOMATION_RULES.dormantLeadAfterDays} jours.`);
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

  return result;
}
