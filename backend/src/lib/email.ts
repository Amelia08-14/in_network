import { env } from '../config/env';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// Fournisseur email transactionnel — proposition Resend, à confirmer (CDC §1.4 / §9).
// En l'absence de clé API (dev local), on se contente de logger le contenu
// pour ne pas bloquer le développement des flux qui en dépendent (vérif. email, factures...).
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`[email:dev] à=${to} sujet="${subject}"\n${html}\n`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Échec d'envoi email (Resend): ${response.status} ${body}`);
  }
}
