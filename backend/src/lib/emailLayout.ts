import { env } from '../config/env';

// Gabarit des e-mails transactionnels, charte « Bleu Nuit » (27/10/2026) :
// bleu nuit #001042 et beige, orange #D44835 en aplat pour les liens et les
// boutons (jamais de dégradé). Appliqué par sendEmail à tous les envois : les
// modules continuent d'écrire un simple fragment HTML (<p>, <ul>, <a>…), mis en
// forme ici. Mise en page en tableaux et styles en ligne, seule façon d'avoir
// un rendu fiable dans Gmail, Outlook et les clients mobiles.

const BRAND = {
  ink: '#001042',
  paper: '#F6F0E6',
  paperDeep: '#ECE2D2',
  orange: '#D44835',
  text: '#2B3352',
  muted: '#6B7290',
  line: '#E4DCCB',
};

const FONT_BODY = "Helvetica, Arial, 'Segoe UI', sans-serif";
const FONT_HEADING = "'Roboto Slab', Georgia, 'Times New Roman', serif";

// Coordonnées du lieu (cf. frontend/src/lib/site-info.ts).
const ADDRESS = 'N°08, Parc Paradou, Hydra 16035 — Alger, Algérie';

/** Échappe un texte saisi par un utilisateur (prénom, raison sociale) avant de l'insérer dans un e-mail. */
export const escapeHtml = (value: string | null | undefined) =>
  (value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Bouton d'appel à l'action (tableau « bulletproof », lisible même sans images). */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="border-radius:10px;background:${BRAND.orange};">`
    + `<a href="${escapeAttr(href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT_BODY};font-size:15px;font-weight:bold;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>`
    + '</td></tr></table>';
}

/** Encadré d'informations (identifiants, montant, référence…). */
export function emailPanel(innerHtml: string): string {
  return `<div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:${BRAND.paper};border:1px solid ${BRAND.line};font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${BRAND.text};">${innerHtml}</div>`;
}

/** Styles en ligne sur les balises courantes des fragments écrits par les modules. */
function styleContent(html: string): string {
  const add = (tag: string, style: string) => (fragment: string) =>
    fragment.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), (match, attrs: string | undefined) =>
      attrs && /\sstyle=/i.test(attrs) ? match : `<${tag}${attrs ?? ''} style="${style}">`,
    );
  return [
    add('p', `margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${BRAND.text};`),
    add('ul', `margin:0 0 16px;padding-left:20px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${BRAND.text};`),
    add('ol', `margin:0 0 16px;padding-left:20px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${BRAND.text};`),
    add('li', 'margin:0 0 6px;'),
    add('h2', `margin:0 0 14px;font-family:${FONT_HEADING};font-size:20px;line-height:1.3;color:${BRAND.ink};`),
    add('strong', `color:${BRAND.ink};`),
    add('a', `color:${BRAND.orange};font-weight:bold;text-decoration:underline;`),
  ].reduce((acc, apply) => apply(acc), html);
}

/** Document HTML complet aux couleurs d'IN NETWORK, autour d'un fragment de contenu. */
export function renderEmail({ subject, html }: { subject: string; html: string }): string {
  // Un module qui fournit déjà un document complet garde sa mise en page.
  if (/^\s*<!doctype|^\s*<html/i.test(html)) return html;
  const site = env.appUrl.replace(/\/$/, '');
  const siteLabel = site.replace(/^https?:\/\//, '');
  const year = new Date().getFullYear();
  // Texte d'aperçu (boîte de réception) : la première phrase du message.
  const preheader = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeAttr(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@600;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) { .card { padding: 28px 22px !important; } .wrap { padding: 16px 10px !important; } }
  a { color: ${BRAND.orange}; }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeAttr(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.paper};">
  <tr><td class="wrap" align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr><td align="left" style="background:${BRAND.ink};border-radius:18px 18px 0 0;padding:26px 32px;">
        <a href="${site}" style="text-decoration:none;">
          <img src="${site}/email/logo-in-network-white.png" width="130" height="70" alt="IN NETWORK" style="display:block;border:0;outline:none;font-family:${FONT_HEADING};font-size:22px;font-weight:bold;color:#ffffff;">
        </a>
      </td></tr>
      <tr><td style="background:${BRAND.orange};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td class="card" style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};">
        ${styleContent(html)}
      </td></tr>
      <tr><td style="background:${BRAND.ink};border-radius:0 0 18px 18px;padding:24px 32px;font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:#C9CEDF;">
        <p style="margin:0 0 6px;font-family:${FONT_HEADING};font-size:15px;font-weight:bold;color:#ffffff;">IN NETWORK <span style="font-family:${FONT_BODY};font-size:12px;font-weight:normal;color:#9AA3C0;">— La Maison IN Groupe</span></p>
        <p style="margin:0;">${ADDRESS}</p>
        <p style="margin:0;"><a href="tel:${env.company.phone.replace(/\s+/g, '')}" style="color:#C9CEDF;text-decoration:none;">${env.company.phone}</a> · <a href="mailto:${env.company.email}" style="color:#C9CEDF;text-decoration:none;">${env.company.email}</a> · <a href="${site}" style="color:${BRAND.orange};text-decoration:none;font-weight:bold;">${siteLabel}</a></p>
      </td></tr>
      <tr><td align="center" style="padding:18px 12px 0;font-family:${FONT_BODY};font-size:11px;line-height:1.5;color:${BRAND.muted};">
        Vous recevez cet e-mail dans le cadre de votre relation avec IN NETWORK. © ${year} IN NETWORK.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
