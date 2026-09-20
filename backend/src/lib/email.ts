import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Pièces jointes (devis / factures PDF) — SMTP et Resend. */
  attachments?: EmailAttachment[];
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
export async function sendEmail({ to, subject, html, attachments }: SendEmailInput): Promise<void> {
  if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    await getTransporter().sendMail({ from: env.emailFrom, to, subject, html, attachments });
    return;
  }

  if (env.resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to,
        subject,
        html,
        attachments: attachments?.map((file) => ({ filename: file.filename, content: file.content.toString('base64') })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Échec d'envoi email (Resend): ${response.status} ${body}`);
    }
    return;
  }

  const attached = attachments?.length ? ` (+${attachments.length} pièce(s) jointe(s): ${attachments.map((a) => a.filename).join(', ')})` : '';
  console.log(`[email:dev] à=${to} sujet="${subject}"${attached}\n${html}\n`);
}
