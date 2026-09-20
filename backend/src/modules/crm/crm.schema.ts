import { z } from 'zod';
import {
  ActivityType,
  AppointmentStatus,
  AppointmentType,
  InvoicePaymentMethod,
  LeadSource,
  LeadStage,
  ServiceOrderStatus,
} from '../../generated/prisma/client';

// '' et null (champ vidé dans un formulaire) valent « pas de valeur ».
const text = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable());
const email = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().email('Adresse email invalide').max(190).nullable());
const nullableDate = z.preprocess((v) => (v === null || v === '' ? null : v), z.coerce.date().nullable());
const amount = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().nonnegative().max(1e10).nullable());

// --- Leads ---------------------------------------------------------------------

export const leadBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(190),
  contactName: z.string().trim().min(1, 'Le nom du contact est requis').max(190),
  email: email.optional(),
  phone: text(60).optional(),
  companyName: text(190).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  expectedAmount: amount.optional(),
  notes: text(5000).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  nextActionAt: nullableDate.optional(),
});
export const leadPatchSchema = leadBodySchema.partial();

export const leadListQuerySchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  assignee: z.string().optional(), // 'me' | 'none' | id
  search: z.string().optional(),
});

export const stageBodySchema = z.object({
  stage: z.nativeEnum(LeadStage),
  lostReason: z.string().trim().max(500).optional(),
});

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
export const quotePatchSchema = z.object({
  validUntil: nullableDate.optional(),
  notes: text(3000).optional(),
  vatRate: vatSchema.optional(),
  lines: linesSchema.optional(),
});
export const quoteListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
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
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  leadId: z.string().optional(),
  search: z.string().optional(),
});

// --- Lancement des services -------------------------------------------------------------

export const orderListQuerySchema = z.object({
  status: z.nativeEnum(ServiceOrderStatus).optional(),
  assignee: z.string().optional(),
});
export const orderPatchSchema = z.object({
  status: z.nativeEnum(ServiceOrderStatus).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  dueAt: nullableDate.optional(),
  notes: text(3000).optional(),
});
export const taskBodySchema = z.object({ title: z.string().trim().min(1).max(190) });
export const taskPatchSchema = z.object({ isDone: z.boolean() });
