import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { renderEmail } from './emailLayout';

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

// Timeouts courts : le serveur SMTP de l'hébergeur est parfois lent à répondre
// (connexion TCP qui traîne) — sans ça une requête d'inscription/reset restait
// accrochée ~20s avant d'échouer.
//
// Retour de l'Office Manager (24/11/2026) : « il faut cliquer plusieurs fois
// sur Renvoyer le devis pour que ça passe ». Cause : le transport était en
// `pool` — la connexion SMTP gardée ouverte entre deux envois est fermée par
// le serveur de l'hébergeur au bout de quelques minutes d'inactivité, et le
// premier envoi suivant partait sur ce socket mort (échec), le second ouvrait
// une connexion neuve (succès). Désormais : une connexion neuve par e-mail
// (le volume est faible) et jusqu'à 3 tentatives sur les erreurs passagères.
function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    // Un devis ou une facture part avec son PDF : on laisse le temps au
    // serveur d'accepter la pièce jointe.
    socketTimeout: 30_000,
  });
}

/** Erreurs d'authentification / d'adresse : inutile de réessayer. */
function isPermanentSmtpError(err: unknown) {
  const e = err as { responseCode?: number; code?: string };
  return e?.code === 'EAUTH' || e?.code === 'EENVELOPE' || (typeof e?.responseCode === 'number' && e.responseCode >= 500);
}

async function sendViaSmtp(message: Parameters<ReturnType<typeof createSmtpTransporter>['sendMail']>[0]) {
  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const transporter = createSmtpTransporter();
    try {
      await transporter.sendMail(message);
      return;
    } catch (err) {
      lastError = err;
      if (isPermanentSmtpError(err) || attempt === attempts) break;
      console.warn(`[email] tentative ${attempt}/${attempts} échouée, nouvel essai`, err instanceof Error ? err.message : err);
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    } finally {
      transporter.close();
    }
  }
  throw lastError;
}

// Fournisseur email transactionnel : SMTP (compte hébergeur, cf. CDC §9)
// en priorité. Resend reste supporté si RESEND_API_KEY est renseignée (pas
// de SMTP configuré). En l'absence totale de configuration (dev local), on
// se contente de logger le contenu pour ne pas bloquer le développement des
// flux qui en dépendent (vérif. email, factures...).
export async function sendEmail({ to, subject, html, attachments }: SendEmailInput): Promise<void> {
  // Charte graphique IN NETWORK appliquée à tous les e-mails (cf. emailLayout.ts).
  const document = renderEmail({ subject, html });
  if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    await sendViaSmtp({ from: env.emailFrom, to, subject, html: document, attachments });
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
        html: document,
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
