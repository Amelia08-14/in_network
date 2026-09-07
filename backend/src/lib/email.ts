import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  // Adresse à laquelle un « Répondre » doit aller (ex: l'email saisi dans un
  // formulaire de contact) — distincte de `from` qui reste l'adresse d'envoi.
  replyTo?: string;
}

// Pool + timeouts courts : le serveur SMTP de l'hébergeur est parfois lent à
// répondre (connexion TCP qui traîne) — sans ça une requête d'inscription/
// reset restait accrochée ~20s avant d'échouer.
function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

let transporter: ReturnType<typeof createSmtpTransporter> | undefined;

function getTransporter(): ReturnType<typeof createSmtpTransporter> {
  if (!transporter) {
    transporter = createSmtpTransporter();
  }
  return transporter;
}

// Fournisseur email transactionnel : SMTP (compte hébergeur, cf. CDC §9)
// en priorité. Resend reste supporté si RESEND_API_KEY est renseignée (pas
// de SMTP configuré). En l'absence totale de configuration (dev local), on
// se contente de logger le contenu pour ne pas bloquer le développement des
// flux qui en dépendent (vérif. email, factures...).
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<void> {
  if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    await getTransporter().sendMail({ from: env.emailFrom, to, subject, html, replyTo });
    return;
  }

  if (env.resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html, reply_to: replyTo }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Échec d'envoi email (Resend): ${response.status} ${body}`);
    }
    return;
  }

  console.log(`[email:dev] à=${to} sujet="${subject}"\n${html}\n`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char,
  );
}

// Relaye la soumission d'un formulaire public du site (contact, demande de
// service, demande de réservation...) vers la boîte de réception unique
// `FORMS_INBOX`. L'objet reprend le titre du formulaire pour que le
// destinataire identifie l'origine de l'entrée d'un coup d'œil. Non bloquant :
// l'appelant catch l'erreur, un aléa SMTP ne doit jamais faire échouer la
// soumission elle-même.
export async function notifyFormSubmission(input: {
  formTitle: string;
  fields: Array<{ label: string; value: string | null | undefined }>;
  replyTo?: string;
}): Promise<void> {
  const rows = input.fields
    .filter((f) => f.value != null && String(f.value).trim() !== '')
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#64748b;font-weight:600;white-space:nowrap">${escapeHtml(
          f.label,
        )}</td><td style="padding:6px 0;vertical-align:top;color:#0f1b2e">${escapeHtml(
          String(f.value),
        ).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');

  const html = [
    `<p style="margin:0 0 4px;font-size:13px;color:#64748b">Nouvelle entrée — formulaire du site IN NETWORK</p>`,
    `<h2 style="margin:0 0 16px;font-size:18px;color:#0f1b2e">${escapeHtml(input.formTitle)}</h2>`,
    `<table style="border-collapse:collapse;font-size:14px">${rows}</table>`,
  ].join('');

  await sendEmail({
    to: env.formsInbox,
    subject: `IN NETWORK — ${input.formTitle}`,
    html,
    replyTo: input.replyTo,
  });
}
