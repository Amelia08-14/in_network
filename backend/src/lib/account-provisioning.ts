import crypto from 'node:crypto';
import { sendEmail } from './email';
import { env } from '../config/env';
import { emailButton, emailPanel, escapeHtml } from './emailLayout';

// Provisioning de comptes à mot de passe généré (jamais choisi par le
// créateur, jamais renvoyé par l'API) — mutualisé entre les « Utilisateurs
// système » du backoffice (systemUsers.service.ts) et les collaborateurs
// invités par un compte entreprise (companies.service.ts).

export function generatePassword(): string {
  // 12 caractères url-safe — l'utilisateur peut le changer ensuite.
  return crypto.randomBytes(9).toString('base64url');
}

interface CredentialsEmailInput {
  to: string;
  name: string;
  password: string;
  /** Chemin de connexion (ex. '/admin' pour le backoffice, '/login' pour l'espace membre). */
  loginPath: string;
  /** Phrase d'introduction décrivant le type d'accès créé. */
  intro: string;
  subject: string;
}

export function sendCredentialsEmail({
  to,
  name,
  password,
  loginPath,
  intro,
  subject,
}: CredentialsEmailInput): void {
  sendEmail({
    to,
    subject,
    html: `<p>Bonjour ${escapeHtml(name)},</p>
<p>${intro}</p>
${emailPanel(`<p style="margin:0;"><strong>Identifiant :</strong> ${escapeHtml(to)}<br><strong>Mot de passe :</strong> ${escapeHtml(password)}</p>`)}
${emailButton('Me connecter', `${env.appUrl}${loginPath}`)}
<p>Nous vous recommandons de changer ce mot de passe après votre première connexion.</p>
<p>L’équipe IN NETWORK</p>`,
  }).catch((err) => console.error('[provisioning] échec envoi email des accès', err));
}
