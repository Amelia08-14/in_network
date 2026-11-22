import type { LeadChannel, LeadCircuit, LeadKind, LeadPipeline, LeadStage } from '../../generated/prisma/client';

// Règles du processus commercial IN NETWORK v1.3, en un seul endroit :
// étapes du lead, pipelines et canaux, circuits. Les services (leadFlow,
// quotes, invoices…) s'y réfèrent ; l'interface en a un miroir (frontend
// src/lib/crm.ts) pour les libellés.

export const STAGE_ORDER: LeadStage[] = [
  'REGISTERED',
  'ASSIGNED',
  'QUALIFIED',
  'FOLLOW_UP',
  'VISIT_CONFIRMED',
  'QUOTE_SENT',
  'CONFIRMED',
  'PAID',
  'LOST',
];

// Libellés simplifiés (retours IN NETWORK du 22/11/2026 : « trop compliqué,
// sans signalétique ») : des mots du quotidien, plus de « circuit 1 / 2 ».
export const STAGE_LABEL: Record<LeadStage, string> = {
  REGISTERED: 'Nouveau',
  ASSIGNED: 'Pris en charge',
  QUALIFIED: 'Besoin identifié',
  FOLLOW_UP: 'Relance',
  VISIT_CONFIRMED: 'Visite prévue',
  QUOTE_SENT: 'Devis envoyé',
  CONFIRMED: 'Devis accepté',
  PAID: 'Payé',
  LOST: 'Perdu',
};

/** « Pris en charge » chez l'Office Manager, « Confié à un commercial » sinon. */
export function stageLabel(stage: LeadStage, circuit: LeadCircuit | null | undefined): string {
  if (stage === 'ASSIGNED') return circuit === 'SALES_TEAM' ? 'Confié à un commercial' : 'Pris en charge';
  return STAGE_LABEL[stage];
}

export const OPEN_STAGES: LeadStage[] = ['REGISTERED', 'ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED'];
export const CLOSED_STAGES: LeadStage[] = ['PAID', 'LOST'];
/** Étapes du travail commercial avant la visite : c'est là qu'on relance. */
export const PRE_VISIT_STAGES: LeadStage[] = ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP'];

export const isOpen = (stage: LeadStage) => OPEN_STAGES.includes(stage);
export const stageIndex = (stage: LeadStage) => STAGE_ORDER.indexOf(stage);

export const CIRCUIT_LABEL: Record<LeadCircuit, string> = {
  SALES_TEAM: 'Suivi par un commercial',
  OFFICE_MANAGER: 'Suivi par l’Office Manager',
};

export const KIND_LABEL: Record<LeadKind, string> = {
  NEW_BUSINESS: 'Nouveau client',
  EXTENSION: 'Extension',
  RENEWAL: 'Renouvellement',
};

export const PIPELINE_LABEL: Record<LeadPipeline, string> = {
  DIGITAL: 'Digital et entrant',
  COMMUNITY: 'Événements et communauté',
  PARTNERS: 'Partenaires et recommandations',
  DIASPORA_DIRECT: 'Diaspora et contacts directs',
};

export const CHANNEL_PIPELINE: Record<LeadChannel, LeadPipeline> = {
  LINKEDIN: 'DIGITAL',
  SOCIAL_MEDIA: 'DIGITAL',
  WEBSITE: 'DIGITAL',
  ADVERTISING: 'DIGITAL',
  COLD_MAILING: 'DIGITAL',
  WORKSHOP: 'COMMUNITY',
  OPEN_DAY: 'COMMUNITY',
  IN_TALK: 'COMMUNITY',
  MEMBER_REFERRAL: 'COMMUNITY',
  ACCOUNTANT: 'PARTNERS',
  LAWYER: 'PARTNERS',
  SCHOOL: 'PARTNERS',
  INCUBATOR: 'PARTNERS',
  LMIG_SUBSIDIARY: 'PARTNERS',
  DIASPORA_FRANCE: 'DIASPORA_DIRECT',
  DIASPORA_CANADA: 'DIASPORA_DIRECT',
  DIASPORA_UAE: 'DIASPORA_DIRECT',
  WHATSAPP: 'DIASPORA_DIRECT',
  DIRECT_MESSAGE: 'DIASPORA_DIRECT',
  WALK_IN: 'DIASPORA_DIRECT',
  PHONE: 'DIASPORA_DIRECT',
};

export const CHANNEL_LABEL: Record<LeadChannel, string> = {
  LINKEDIN: 'LinkedIn',
  SOCIAL_MEDIA: 'Réseaux sociaux',
  WEBSITE: 'Site web',
  ADVERTISING: 'Publicité',
  COLD_MAILING: 'Cold mailing',
  WORKSHOP: 'Workshop',
  OPEN_DAY: 'Portes ouvertes',
  IN_TALK: 'IN Talk',
  MEMBER_REFERRAL: 'Parrainage d’un membre',
  ACCOUNTANT: 'Expert-comptable',
  LAWYER: 'Avocat',
  SCHOOL: 'École',
  INCUBATOR: 'Incubateur',
  LMIG_SUBSIDIARY: 'Filiale LMIG',
  DIASPORA_FRANCE: 'Campagne France',
  DIASPORA_CANADA: 'Campagne Canada',
  DIASPORA_UAE: 'Campagne Émirats',
  WHATSAPP: 'WhatsApp',
  DIRECT_MESSAGE: 'Message direct',
  WALK_IN: 'Visite spontanée',
  PHONE: 'Appel téléphonique',
};

/** Canaux de la diaspora : le paiement se fait par virement. */
export const DIASPORA_CHANNELS: LeadChannel[] = ['DIASPORA_FRANCE', 'DIASPORA_CANADA', 'DIASPORA_UAE'];

/**
 * Circuit suggéré à l'aiguillage (le choix reste humain). Le processus réserve
 * la Sales Team à la prospection et aux leads à travailler ; un événement, une
 * recommandation ou un contact spontané (prospect déjà prêt) va à l'Office Manager.
 */
export function suggestCircuit(lead: { pipeline: LeadPipeline | null; channel: LeadChannel | null }): LeadCircuit {
  if (lead.channel === 'WALK_IN' || lead.channel === 'PHONE') return 'OFFICE_MANAGER';
  if (lead.pipeline === 'COMMUNITY' || lead.pipeline === 'PARTNERS') return 'OFFICE_MANAGER';
  return 'SALES_TEAM';
}
