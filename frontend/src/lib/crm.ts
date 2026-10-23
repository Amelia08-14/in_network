import { getClientApiUrl } from './api-url';
import type { Hue } from './palette';
import { getAdminAccessTokenCookie } from './admin-auth-cookies';
import { tryRefreshAdminAccessToken } from './admin-api';
import type {
  ActivityType,
  AppointmentType,
  CommissionStatus,
  DeliveryPole,
  InvoiceStatus,
  LeadChannel,
  LeadCircuit,
  LeadKind,
  LeadPipeline,
  LeadPriority,
  LeadSource,
  LeadStage,
  MemberServiceStatus,
  OrderStatus,
  PaymentMethod,
  QuoteStatus,
  StaffUser,
} from '@/types/crm';

// Libellés et formats partagés par toutes les pages du CRM commercial —
// miroir de backend/src/modules/crm/workflow.ts (processus commercial v1.3).

export type Tone = Hue;

export const TONE_CLASS: Record<Tone, string> = {
  violet: 'bg-violet-600/10 text-violet-700',
  ink: 'bg-ink-900/10 text-ink-800',
  blue: 'bg-brand-blue/10 text-brand-blue',
  orange: 'bg-brand-orange/10 text-brand-orange',
  green: 'bg-accent-green/20 text-green-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  gray: 'bg-ink-900/6 text-ink-600',
};

// Un seul parcours, du premier contact au paiement. Après le paiement, la suite
// (activation, livraison, échéance) vit sur les services du membre.
export const STAGES: { value: LeadStage; label: string; tone: Tone }[] = [
  { value: 'REGISTERED', label: 'Lead enregistré', tone: 'blue' },
  { value: 'ASSIGNED', label: 'Attribué', tone: 'violet' },
  { value: 'QUALIFIED', label: 'Qualifié', tone: 'ink' },
  { value: 'FOLLOW_UP', label: 'Relance en cours', tone: 'amber' },
  { value: 'VISIT_CONFIRMED', label: 'Visite / visio confirmée', tone: 'blue' },
  { value: 'QUOTE_SENT', label: 'Devis envoyé', tone: 'orange' },
  { value: 'CONFIRMED', label: 'Confirmé', tone: 'violet' },
  { value: 'PAID', label: 'Paiement confirmé', tone: 'green' },
  { value: 'LOST', label: 'Perdu', tone: 'gray' },
];
export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<LeadStage, (typeof STAGES)[number]>;
export const OPEN_STAGES: LeadStage[] = ['REGISTERED', 'ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED'];
/** Avant la visite : c'est là qu'on qualifie et qu'on relance. */
export const PRE_VISIT_STAGES: LeadStage[] = ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP'];
/** Colonnes du pipeline : le travail commercial, une fois le lead aiguillé et confié. */
export const PIPELINE_STAGES = STAGES.filter((s) => s.value !== 'REGISTERED');

/** « Attribué (Sales Team) » en circuit 1, « Pris en charge (Office Manager) » en circuit 2. */
export function stageLabel(stage: LeadStage, circuit: LeadCircuit | null | undefined) {
  if (stage === 'ASSIGNED') return circuit === 'OFFICE_MANAGER' ? 'Pris en charge (OM)' : 'Attribué (Sales)';
  if (stage === 'REGISTERED' && !circuit) return 'À aiguiller';
  if (stage === 'REGISTERED' && circuit === 'SALES_TEAM') return 'À attribuer';
  return STAGE_BY_VALUE[stage].label;
}

export const CIRCUIT: Record<LeadCircuit, { label: string; short: string; tone: Tone }> = {
  SALES_TEAM: { label: 'Circuit 1 · Sales Team', short: 'Circuit 1', tone: 'blue' },
  OFFICE_MANAGER: { label: 'Circuit 2 · Office Manager', short: 'Circuit 2', tone: 'violet' },
};

export const KIND: Record<LeadKind, { label: string; tone: Tone }> = {
  NEW_BUSINESS: { label: 'Nouveau client', tone: 'ink' },
  EXTENSION: { label: 'Extension', tone: 'green' },
  RENEWAL: { label: 'Renouvellement', tone: 'amber' },
};

export const PIPELINE: Record<LeadPipeline, { label: string; tone: Tone }> = {
  DIGITAL: { label: 'Digital et entrant', tone: 'blue' },
  COMMUNITY: { label: 'Événements et communauté', tone: 'violet' },
  PARTNERS: { label: 'Partenaires et recommandations', tone: 'green' },
  DIASPORA_DIRECT: { label: 'Diaspora et contacts directs', tone: 'orange' },
};

export const CHANNELS: { value: LeadChannel; label: string; pipeline: LeadPipeline }[] = [
  { value: 'LINKEDIN', label: 'LinkedIn', pipeline: 'DIGITAL' },
  { value: 'SOCIAL_MEDIA', label: 'Réseaux sociaux', pipeline: 'DIGITAL' },
  { value: 'WEBSITE', label: 'Site web', pipeline: 'DIGITAL' },
  { value: 'ADVERTISING', label: 'Publicité', pipeline: 'DIGITAL' },
  { value: 'COLD_MAILING', label: 'Cold mailing', pipeline: 'DIGITAL' },
  { value: 'WORKSHOP', label: 'Workshop', pipeline: 'COMMUNITY' },
  { value: 'OPEN_DAY', label: 'Portes ouvertes', pipeline: 'COMMUNITY' },
  { value: 'IN_TALK', label: 'IN Talk', pipeline: 'COMMUNITY' },
  { value: 'MEMBER_REFERRAL', label: 'Parrainage d’un membre', pipeline: 'COMMUNITY' },
  { value: 'ACCOUNTANT', label: 'Expert-comptable', pipeline: 'PARTNERS' },
  { value: 'LAWYER', label: 'Avocat', pipeline: 'PARTNERS' },
  { value: 'SCHOOL', label: 'École', pipeline: 'PARTNERS' },
  { value: 'INCUBATOR', label: 'Incubateur', pipeline: 'PARTNERS' },
  { value: 'LMIG_SUBSIDIARY', label: 'Filiale LMIG', pipeline: 'PARTNERS' },
  { value: 'DIASPORA_FRANCE', label: 'Campagne France', pipeline: 'DIASPORA_DIRECT' },
  { value: 'DIASPORA_CANADA', label: 'Campagne Canada', pipeline: 'DIASPORA_DIRECT' },
  { value: 'DIASPORA_UAE', label: 'Campagne Émirats', pipeline: 'DIASPORA_DIRECT' },
  { value: 'WHATSAPP', label: 'WhatsApp', pipeline: 'DIASPORA_DIRECT' },
  { value: 'DIRECT_MESSAGE', label: 'Message direct', pipeline: 'DIASPORA_DIRECT' },
  { value: 'WALK_IN', label: 'Visite spontanée', pipeline: 'DIASPORA_DIRECT' },
  { value: 'PHONE', label: 'Appel téléphonique', pipeline: 'DIASPORA_DIRECT' },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label])) as Record<LeadChannel, string>;
export const DIASPORA_CHANNELS: LeadChannel[] = ['DIASPORA_FRANCE', 'DIASPORA_CANADA', 'DIASPORA_UAE'];

/** Circuit suggéré à l'aiguillage (même règle que le serveur, le choix reste humain). */
export function suggestCircuit(lead: { pipeline: LeadPipeline | null; channel: LeadChannel | null }): LeadCircuit {
  if (lead.channel === 'WALK_IN' || lead.channel === 'PHONE') return 'OFFICE_MANAGER';
  if (lead.pipeline === 'COMMUNITY' || lead.pipeline === 'PARTNERS') return 'OFFICE_MANAGER';
  return 'SALES_TEAM';
}

/** Offres vers lesquelles orienter le prospect (phase 2 du processus). */
export const OFFER_OPTIONS = [
  'Starter',
  'Builder',
  'Accelerator',
  'Domiciliation Pro',
  'Event & Com',
  'Abonnement annuel Access',
  'Abonnement annuel Premium',
  'Abonnement annuel Elite',
  'Parcours diaspora',
];

export const PRIORITY: Record<LeadPriority, { label: string; tone: Tone }> = {
  COLD: { label: 'Froid', tone: 'blue' },
  WARM: { label: 'Tiède', tone: 'amber' },
  HOT: { label: 'Chaud', tone: 'orange' },
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  REGISTRATION: 'Inscription sur le site',
  WEBSITE_QUOTE: 'Demande de devis du site',
  CONTACT_FORM: 'Formulaire de contact',
  MEMBER_SPACE: 'Espace membre',
  MEMBER_REFERRAL: 'Recommandation d’un membre',
  MANUAL: 'Saisie par l’équipe',
};

/** « LinkedIn · Digital et entrant » — d'où vient le lead, en une ligne. */
export function originLabel(lead: { channel: LeadChannel | null; pipeline: LeadPipeline | null; source: LeadSource; channelDetail?: string | null }) {
  const parts = [lead.channel ? CHANNEL_LABEL[lead.channel] : null, lead.channelDetail, lead.pipeline ? PIPELINE[lead.pipeline].label : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : SOURCE_LABEL[lead.source];
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: 'Note',
  CALL: 'Appel',
  EMAIL: 'Email',
  MEETING: 'Réunion',
  VISIT: 'Visite',
  SYSTEM: 'Système',
};
export const MANUAL_ACTIVITY_TYPES: ActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'VISIT'];

export const APPOINTMENT_LABEL: Record<AppointmentType, string> = {
  CALL: 'Appel',
  VISIT: 'Visite',
  VIDEO: 'Visio',
  TRIAL_DAY: 'Journée d’essai',
  MEETING: 'Réunion',
};

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'gray' },
  PENDING_APPROVAL: { label: 'À valider', tone: 'amber' },
  SENT: { label: 'Envoyé', tone: 'blue' },
  ACCEPTED: { label: 'Confirmé', tone: 'green' },
  REJECTED: { label: 'Refusé', tone: 'red' },
  EXPIRED: { label: 'Expiré', tone: 'amber' },
};
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'gray' },
  SENT: { label: 'Proforma à régler', tone: 'blue' },
  PAID: { label: 'Payée', tone: 'green' },
  CANCELLED: { label: 'Annulée', tone: 'red' },
  REFUNDED: { label: 'Remboursée', tone: 'amber' },
};
/** Numéro affiché : la facture définitive (FA-…) dès le paiement, la proforma (PF-…) avant. */
export const invoiceNumber = (invoice: { number: string | null; proformaNumber?: string | null }) => invoice.number ?? invoice.proformaNumber ?? 'Brouillon';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  TO_START: { label: 'À lancer', tone: 'amber' },
  IN_PROGRESS: { label: 'Activation en cours', tone: 'blue' },
  AWAITING_VALIDATION: { label: 'En attente de validation', tone: 'violet' },
  ADJUSTMENT_REQUESTED: { label: 'Ajustement demandé', tone: 'orange' },
  DONE: { label: 'Livré / Actif', tone: 'green' },
  CANCELLED: { label: 'Annulé', tone: 'gray' },
};
export const POLE: Record<DeliveryPole, { label: string; tone: Tone; who: string }> = {
  SPACES: { label: 'Espaces et domiciliation', tone: 'blue', who: 'Office Manager' },
  COMPANY_CREATION: { label: 'Création d’entreprise', tone: 'orange', who: 'Support administratif' },
  IN_GROUP: { label: 'Solutions IN Group', tone: 'violet', who: 'Filiale concernée' },
};
/** Statut du service vu par le membre (calculé par l'API à partir des dates). */
export const MEMBER_SERVICE_STATUS: Record<MemberServiceStatus, { label: string; tone: Tone }> = {
  ACTIVATING: { label: 'En cours d’activation', tone: 'blue' },
  AWAITING_VALIDATION: { label: 'À valider', tone: 'violet' },
  ADJUSTMENT_REQUESTED: { label: 'Ajustement demandé', tone: 'orange' },
  ACTIVE: { label: 'Actif', tone: 'green' },
  TO_RENEW: { label: 'À renouveler', tone: 'amber' },
  EXPIRED: { label: 'Expiré', tone: 'red' },
  RENEWED: { label: 'Renouvelé', tone: 'gray' },
  CANCELLED: { label: 'Annulé', tone: 'gray' },
};
export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Calculée', tone: 'gray' },
  ELIGIBLE: { label: 'Éligible', tone: 'blue' },
  CHECKED: { label: 'Contrôlée', tone: 'violet' },
  VALIDATED: { label: 'Validée', tone: 'green' },
  PAID: { label: 'Versée', tone: 'green' },
  CANCELLED: { label: 'Reprise', tone: 'red' },
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

export const SALES_ROLES = ['SALES_MANAGER', 'SALES_AGENT'];
export const SALES_PROFILE_LABEL: Record<'SEDENTARY' | 'FIELD', string> = { SEDENTARY: 'sédentaire', FIELD: 'terrain' };

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
