import { getClientApiUrl } from './api-url';
import type { Hue } from './palette';
import { getAdminAccessTokenCookie } from './admin-auth-cookies';
import { tryRefreshAdminAccessToken } from './admin-api';
import type {
  ActivityType,
  AppointmentType,
  InvoiceStatus,
  LeadSource,
  LeadStage,
  OrderStatus,
  PaymentMethod,
  QuoteStatus,
  StaffUser,
} from '@/types/crm';

// Libellés et formats partagés par toutes les pages du CRM commercial.

export type Tone = Hue;

export const TONE_CLASS: Record<Tone, string> = {
  teal: 'bg-teal-600/10 text-teal-700',
  ink: 'bg-ink-900/10 text-ink-800',
  blue: 'bg-brand-blue/10 text-brand-blue',
  orange: 'bg-brand-orange/10 text-brand-orange',
  green: 'bg-accent-green/20 text-green-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  gray: 'bg-ink-900/6 text-ink-600',
};

export const STAGES: { value: LeadStage; label: string; tone: Tone }[] = [
  { value: 'NEW', label: 'Nouveau', tone: 'blue' },
  { value: 'CONTACTED', label: 'Contacté', tone: 'teal' },
  { value: 'QUALIFIED', label: 'Qualifié', tone: 'amber' },
  { value: 'QUOTE_SENT', label: 'Devis envoyé', tone: 'orange' },
  { value: 'WON', label: 'Gagné', tone: 'green' },
  { value: 'LOST', label: 'Perdu', tone: 'gray' },
];
export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<LeadStage, (typeof STAGES)[number]>;

export const SOURCE_LABEL: Record<LeadSource, string> = {
  REGISTRATION: 'Inscription sur le site',
  WEBSITE_QUOTE: 'Demande de devis du site',
  CONTACT_FORM: 'Formulaire de contact',
  PHONE: 'Téléphone',
  VISIT: 'Visite',
  REFERRAL: 'Recommandation',
  EVENT: 'Événement',
  OTHER: 'Autre',
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: 'Note',
  CALL: 'Appel',
  EMAIL: 'Email',
  MEETING: 'Réunion',
  VISIT: 'Visite',
  SYSTEM: 'Système',
};
export const MANUAL_ACTIVITY_TYPES: ActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'VISIT'];

export const APPOINTMENT_LABEL: Record<AppointmentType, string> = { CALL: 'Appel', VISIT: 'Visite', MEETING: 'Réunion' };

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'gray' },
  SENT: { label: 'Envoyé', tone: 'blue' },
  ACCEPTED: { label: 'Accepté', tone: 'green' },
  REJECTED: { label: 'Refusé', tone: 'red' },
  EXPIRED: { label: 'Expiré', tone: 'amber' },
};
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'gray' },
  SENT: { label: 'Émise', tone: 'blue' },
  PAID: { label: 'Payée', tone: 'green' },
  CANCELLED: { label: 'Annulée', tone: 'red' },
};
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  TO_START: { label: 'À lancer', tone: 'amber' },
  IN_PROGRESS: { label: 'En cours', tone: 'blue' },
  DONE: { label: 'Livré', tone: 'green' },
  CANCELLED: { label: 'Annulé', tone: 'gray' },
};
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Virement bancaire',
  CASH: 'Espèces',
  CHEQUE: 'Chèque',
  CARD: 'Carte bancaire',
};

export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DA`;
}

export const dateFr = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—';
export const dateTimeFr = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Valeurs pour <input type="date"> / <input type="datetime-local"> (heure locale).
const pad = (n: number) => String(n).padStart(2, '0');
export function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toInputDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return `${toInputDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const staffName = (user: Pick<StaffUser, 'displayName' | 'email'> | null | undefined) =>
  user ? user.displayName || user.email : 'Non assigné';

export const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

// Les PDF (devis, factures) sont protégés par le jeton admin : on ne peut pas
// les ouvrir par un simple lien. On les télécharge avec l'en-tête Authorization
// puis on les affiche dans un nouvel onglet.
export async function openAdminPdf(path: string): Promise<void> {
  const fetchPdf = () =>
    fetch(`${getClientApiUrl()}${path}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAdminAccessTokenCookie() ?? ''}` },
    });
  let response = await fetchPdf();
  if (response.status === 401 && (await tryRefreshAdminAccessToken().catch(() => false))) response = await fetchPdf();
  if (!response.ok) throw new Error('Impossible de générer le PDF.');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
