import { z } from 'zod';
import {
  ActivityType,
  AppointmentStatus,
  AppointmentType,
  CommissionBeneficiary,
  CommissionMode,
  CommissionStatus,
  DeliveryPole,
  InvoicePaymentMethod,
  LeadChannel,
  LeadCircuit,
  LeadKind,
  LeadPipeline,
  LeadPriority,
  LeadSource,
  LeadStage,
  MemberDocumentKind,
  ServiceCategory,
  ServiceOrderStatus,
} from '../../generated/prisma/client';

// '' et null (champ vidé dans un formulaire) valent « pas de valeur ».
const text = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable());
const email = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().email('Adresse email invalide').max(190).nullable());
const nullableDate = z.preprocess((v) => (v === null || v === '' ? null : v), z.coerce.date().nullable());
const amount = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().nonnegative().max(1e10).nullable());

// --- Leads ---------------------------------------------------------------------

const nullableEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess((v) => (v === '' ? null : v), z.nativeEnum(values).nullable());

export const leadBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(190),
  contactName: z.string().trim().min(1, 'Le nom du contact est requis').max(190),
  email: email.optional(),
  phone: text(60).optional(),
  companyName: text(190).optional(),
  channel: nullableEnum(LeadChannel).optional(),
  channelDetail: text(190).optional(),
  pipeline: nullableEnum(LeadPipeline).optional(),
  circuit: nullableEnum(LeadCircuit).optional(),
  expectedAmount: amount.optional(),
  notes: text(5000).optional(),
  offerInterest: text(190).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  nextActionAt: nullableDate.optional(),
});
// Le circuit et les intervenants changent par les actions dédiées (aiguillage, attribution, passerelle).
export const leadPatchSchema = leadBodySchema.omit({ circuit: true, assignedToId: true }).partial();

export const leadListQuerySchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  circuit: z.union([z.nativeEnum(LeadCircuit), z.literal('none')]).optional(),
  pipeline: z.nativeEnum(LeadPipeline).optional(),
  kind: z.nativeEnum(LeadKind).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  queue: z.enum(['to_dispatch', 'to_assign', 'returned', 'handed_over', 'to_call', 'follow_ups_due']).optional(),
  assignee: z.string().optional(), // 'me' | 'none' | id
  search: z.string().optional(),
});

export const dispatchBodySchema = z.object({
  circuit: z.nativeEnum(LeadCircuit),
  assignedToId: z.string().min(1).nullable().optional(),
});
export const assignBodySchema = z.object({ assignedToId: z.string().min(1).nullable() });
export const circuitBodySchema = z.object({
  circuit: z.nativeEnum(LeadCircuit),
  reason: z.string().trim().min(5, 'Indiquez le motif de la passerelle').max(1000),
  officeManagerId: z.string().min(1).nullable().optional(),
});

export const qualifyBodySchema = z.object({
  priority: z.nativeEnum(LeadPriority),
  profile: text(300).optional(),
  project: text(1000).optional(),
  maturity: text(300).optional(),
  need: text(1000).optional(),
  budget: text(300).optional(),
  decisionMaker: text(300).optional(),
  timeline: text(300).optional(),
  notes: text(2000).optional(),
  offerInterest: text(190).optional(),
});

export const followUpBodySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING']),
  content: z.string().trim().min(1, 'Résumez la relance').max(2000),
  answered: z.boolean(),
  nextActionAt: nullableDate.optional(),
});

export const visitBodySchema = z.object({
  type: z.enum(['VISIT', 'VIDEO', 'TRIAL_DAY']),
  startAt: z.coerce.date(),
  endAt: nullableDate.optional(),
  location: text(190).optional(),
  notes: text(2000).optional(),
  officeManagerId: z.string().min(1).nullable().optional(),
});

export const loseBodySchema = z.object({ reason: z.string().trim().min(2, 'Indiquez le motif').max(500) });

export const activityBodySchema = z.object({
  type: z.nativeEnum(ActivityType).refine((t) => t !== 'SYSTEM', 'Type invalide'),
  content: z.string().trim().min(1, 'Écrivez quelque chose').max(5000),
  occurredAt: z.coerce.date().optional(),
  mentionIds: z.array(z.string()).max(10).optional(),
});

export const activityListQuerySchema = z.object({
  authorId: z.string().optional(),
  type: z.nativeEnum(ActivityType).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().optional(),
});

export const appointmentBodySchema = z.object({
  type: z.nativeEnum(AppointmentType),
  startAt: z.coerce.date(),
  endAt: nullableDate.optional(),
  location: text(190).optional(),
  notes: text(2000).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});
export const appointmentPatchSchema = appointmentBodySchema.partial().extend({ status: z.nativeEnum(AppointmentStatus).optional() });

export const appointmentListQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  assigneeId: z.string().optional(),
});

// --- Lignes (devis / factures) -----------------------------------------------------

export const docLineSchema = z.object({
  description: z.string().trim().min(1, 'Une ligne doit avoir une désignation').max(1000),
  quantity: z.coerce.number().positive('Quantité invalide').max(100000),
  unitPrice: z.coerce.number().nonnegative('Prix invalide').max(1e10),
  serviceId: z.string().nullish(),
  planId: z.string().nullish(),
  spaceId: z.string().nullish(),
  tierLabel: z.string().nullish(),
});
const linesSchema = z.array(docLineSchema).max(60);
const vatSchema = z.coerce.number().min(0).max(100);

// --- Devis ----------------------------------------------------------------------------

export const quoteCreateSchema = z.object({ leadId: z.string().min(1), templateId: z.string().min(1).optional() });
export const quoteReturnSchema = z.object({ comment: z.string().trim().min(3, 'Indiquez ce qui doit être revu').max(1000) });
export const quotePatchSchema = z.object({
  validUntil: nullableDate.optional(),
  notes: text(3000).optional(),
  vatRate: vatSchema.optional(),
  lines: linesSchema.optional(),
});
export const quoteListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
  leadId: z.string().optional(),
  search: z.string().optional(),
});

export const templateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: text(300).optional(),
  validityDays: z.coerce.number().int().min(1).max(365).optional(),
  notes: text(3000).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(1000),
        quantity: z.coerce.number().positive().optional(),
        unitPrice: z.coerce.number().nonnegative(),
        serviceSlug: z.string().optional(),
        tierLabel: z.string().optional(),
      }),
    )
    .min(1, 'Ajoutez au moins une ligne'),
  isActive: z.boolean().optional(),
});
export const templatePatchSchema = templateBodySchema.partial();

// --- Factures -------------------------------------------------------------------------

const customerFields = {
  customerName: z.string().trim().min(1).max(190).optional(),
  customerCompany: text(190).optional(),
  customerEmail: email.optional(),
  customerPhone: text(60).optional(),
  customerAddress: text(400).optional(),
  customerNif: text(60).optional(),
  customerRc: text(60).optional(),
  customerAi: text(60).optional(),
};
export const invoiceCreateSchema = z
  .object({ leadId: z.string().min(1).optional(), quoteId: z.string().min(1).optional(), lines: linesSchema.optional(), ...customerFields })
  .refine((v) => v.leadId || v.quoteId || v.customerName, { message: 'Précisez un lead, un devis ou le nom du client' });
export const invoicePatchSchema = z.object({
  ...customerFields,
  vatRate: vatSchema.optional(),
  dueDate: nullableDate.optional(),
  notes: text(3000).optional(),
  lines: linesSchema.optional(),
});
export const invoiceIssueSchema = z.object({ dueDate: z.coerce.date().optional(), send: z.boolean().optional() });
export const invoicePaymentSchema = z.object({
  method: z.nativeEnum(InvoicePaymentMethod),
  paidAt: z.coerce.date().optional(),
  reference: text(120).optional(),
});
export const invoiceCancelSchema = z.object({ reason: z.string().trim().min(2, 'Indiquez le motif').max(300) });
export const invoiceListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'REFUNDED']).optional(),
  leadId: z.string().optional(),
  search: z.string().optional(),
});

// --- Lancement des services -------------------------------------------------------------

export const orderListQuerySchema = z.object({
  status: z.nativeEnum(ServiceOrderStatus).optional(),
  pole: z.nativeEnum(DeliveryPole).optional(),
  userId: z.string().optional(),
  expiring: z.enum(['1', 'true']).optional(),
  assignee: z.string().optional(),
});
export const orderPatchSchema = z.object({
  assignedToId: z.string().min(1).nullable().optional(),
  dueAt: nullableDate.optional(),
  startsAt: nullableDate.optional(),
  expiresAt: nullableDate.optional(),
  notes: text(3000).optional(),
});
export const orderNoteSchema = z.object({ note: z.string().trim().min(2, 'Précisez la demande').max(2000) });
export const orderCancelSchema = z.object({ reason: z.string().trim().min(2, 'Indiquez le motif').max(500) });

// --- Fiche membre (référent, documents) --------------------------------------------------

export const referentBodySchema = z.object({ referentId: z.string().min(1).nullable() });
export const documentFieldsSchema = z.object({
  kind: z.nativeEnum(MemberDocumentKind),
  title: z.string().trim().max(190).optional(),
  orderId: z.string().min(1).optional(),
});

// --- Commissions -------------------------------------------------------------------------

export const commissionRuleSchema = z.object({
  beneficiary: z.nativeEnum(CommissionBeneficiary),
  serviceId: z.string().min(1).nullable().optional(),
  planId: z.string().min(1).nullable().optional(),
  category: nullableEnum(ServiceCategory).optional(),
  leadKind: nullableEnum(LeadKind).optional(),
  circuit: nullableEnum(LeadCircuit).optional(),
  mode: z.nativeEnum(CommissionMode),
  value: z.coerce.number().positive('Valeur invalide').max(1e9),
  isActive: z.boolean().optional(),
});
export const commissionRulePatchSchema = commissionRuleSchema.partial();
export const commissionListQuerySchema = z.object({
  status: z.nativeEnum(CommissionStatus).optional(),
  beneficiaryId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export const commissionIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });
export const statementQuerySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Mois au format AAAA-MM') });
export const taskBodySchema = z.object({ title: z.string().trim().min(1).max(190) });
export const taskPatchSchema = z.object({ isDone: z.boolean() });
