import { z } from 'zod';
import type { LeadChannel } from '../../generated/prisma/client';
import { CHANNEL_LABEL, CHANNEL_PIPELINE } from './workflow';

// Origine d'un prospect venu des réseaux sociaux ou d'une campagne : le site
// mémorise les paramètres du lien d'arrivée (utm_source, utm_medium,
// utm_campaign, identifiants de clic publicitaire fbclid / gclid / li_fat_id /
// ttclid) et le site d'où vient le visiteur, puis les joint à l'inscription,
// à la demande de devis ou au message de contact. Ce module les traduit en
// canal du processus v1.3 (LinkedIn, Réseaux sociaux, Publicité, Cold
// mailing…). WhatsApp reste saisi à la main (décision du 23/10/2026), mais un
// lien de campagne « utm_source=whatsapp » est tout de même reconnu.

const field = z.string().trim().max(190).optional();

export const attributionSchema = z
  .object({
    source: field,
    medium: field,
    campaign: field,
    content: field,
    /** Identifiant de clic publicitaire présent dans le lien : fbclid, gclid, li_fat_id, ttclid. */
    clickId: z.enum(['fbclid', 'gclid', 'li_fat_id', 'ttclid']).optional(),
    /** Domaine du site d'où vient le visiteur (ex. l.instagram.com). */
    referrer: field,
  })
  .strip();

export type Attribution = z.infer<typeof attributionSchema>;

const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'ads', 'ad', 'sponsored', 'display', 'leadads', 'lead_ads'];

// Plateforme reconnue → nom affiché et canal (organique). Une campagne payante
// (utm_medium cpc / paid / ads…) bascule en « Publicité », sauf LinkedIn qui
// reste un canal à part entière dans le processus.
const PLATFORMS: { keys: string[]; label: string; channel: LeadChannel }[] = [
  { keys: ['linkedin', 'lnkd', 'li'], label: 'LinkedIn', channel: 'LINKEDIN' },
  { keys: ['facebook', 'fb', 'meta'], label: 'Facebook', channel: 'SOCIAL_MEDIA' },
  { keys: ['instagram', 'ig', 'insta'], label: 'Instagram', channel: 'SOCIAL_MEDIA' },
  { keys: ['tiktok', 'tt'], label: 'TikTok', channel: 'SOCIAL_MEDIA' },
  { keys: ['twitter', 'x'], label: 'X (Twitter)', channel: 'SOCIAL_MEDIA' },
  { keys: ['youtube', 'yt'], label: 'YouTube', channel: 'SOCIAL_MEDIA' },
  { keys: ['snapchat'], label: 'Snapchat', channel: 'SOCIAL_MEDIA' },
  { keys: ['google', 'adwords'], label: 'Google', channel: 'ADVERTISING' },
  { keys: ['whatsapp', 'wa'], label: 'WhatsApp', channel: 'WHATSAPP' },
  { keys: ['email', 'newsletter', 'mailing', 'mailchimp', 'brevo', 'sendinblue', 'emailing'], label: 'E-mailing', channel: 'COLD_MAILING' },
];

const CLICK_IDS: Record<NonNullable<Attribution['clickId']>, { label: string; channel: LeadChannel }> = {
  fbclid: { label: 'Facebook / Instagram', channel: 'SOCIAL_MEDIA' },
  gclid: { label: 'Google Ads', channel: 'ADVERTISING' },
  li_fat_id: { label: 'LinkedIn', channel: 'LINKEDIN' },
  ttclid: { label: 'TikTok', channel: 'SOCIAL_MEDIA' },
};

const REFERRERS: { pattern: RegExp; label: string; channel: LeadChannel }[] = [
  { pattern: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, label: 'LinkedIn', channel: 'LINKEDIN' },
  { pattern: /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/, label: 'Facebook', channel: 'SOCIAL_MEDIA' },
  { pattern: /(^|\.)instagram\.com$/, label: 'Instagram', channel: 'SOCIAL_MEDIA' },
  { pattern: /(^|\.)tiktok\.com$/, label: 'TikTok', channel: 'SOCIAL_MEDIA' },
  { pattern: /(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, label: 'X (Twitter)', channel: 'SOCIAL_MEDIA' },
  { pattern: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, label: 'YouTube', channel: 'SOCIAL_MEDIA' },
  { pattern: /(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, label: 'WhatsApp', channel: 'WHATSAPP' },
];

function platformOf(source: string) {
  const key = source.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return PLATFORMS.find((p) => p.keys.includes(key) || p.keys.some((k) => k.length > 3 && key.startsWith(k)));
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Canal du lead et précision (plateforme · campagne). null si rien de
 * reconnaissable : le lead garde alors le canal « Site web ».
 */
export function channelFromAttribution(attribution: Attribution | null | undefined): { channel: LeadChannel; channelDetail: string } | null {
  if (!attribution) return null;
  const medium = attribution.medium?.toLowerCase();
  const paid = Boolean(medium && PAID_MEDIUMS.includes(medium.replace(/[^a-z_]/g, '')));
  let label: string | null = null;
  let channel: LeadChannel | null = null;

  if (attribution.source) {
    const platform = platformOf(attribution.source);
    if (platform) {
      label = platform.label;
      channel = paid && platform.channel === 'SOCIAL_MEDIA' ? 'ADVERTISING' : platform.channel;
    } else {
      label = titleCase(attribution.source);
      channel = paid ? 'ADVERTISING' : medium === 'email' ? 'COLD_MAILING' : medium === 'social' ? 'SOCIAL_MEDIA' : null;
    }
  }
  if (!channel && attribution.clickId) {
    const click = CLICK_IDS[attribution.clickId];
    label = label ?? click.label;
    channel = click.channel === 'SOCIAL_MEDIA' && paid ? 'ADVERTISING' : click.channel;
  }
  if (!channel && attribution.referrer) {
    const host = attribution.referrer.toLowerCase().replace(/^www\./, '');
    const ref = REFERRERS.find((r) => r.pattern.test(host));
    if (ref) {
      label = label ?? ref.label;
      channel = ref.channel;
    }
  }
  if (!channel) return null;
  const detail = [label, attribution.campaign ? `campagne ${attribution.campaign}` : null].filter(Boolean).join(' · ');
  return { channel, channelDetail: (detail || CHANNEL_LABEL[channel]).slice(0, 190) };
}

/** « LinkedIn · campagne rentrée-2026 (utm_source=linkedin, utm_medium=social) » pour le journal du lead. */
export function describeAttribution(attribution: Attribution | null | undefined): string | null {
  if (!attribution) return null;
  const parts = [
    attribution.source && `utm_source=${attribution.source}`,
    attribution.medium && `utm_medium=${attribution.medium}`,
    attribution.campaign && `utm_campaign=${attribution.campaign}`,
    attribution.content && `utm_content=${attribution.content}`,
    attribution.clickId && `clic publicitaire ${attribution.clickId}`,
    attribution.referrer && `venu de ${attribution.referrer}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Champs Prisma d'un lead créé avec cette origine (canal « Site web » par défaut). */
export function leadOriginFields(attribution: Attribution | null | undefined) {
  const mapped = channelFromAttribution(attribution);
  const channel: LeadChannel = mapped?.channel ?? 'WEBSITE';
  return { channel, pipeline: CHANNEL_PIPELINE[channel], channelDetail: mapped?.channelDetail ?? null };
}
