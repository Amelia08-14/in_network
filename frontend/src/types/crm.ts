import type { AdminProof } from '@/components/admin/PaymentProofs';
// Types du CRM commercial (miroir des réponses de /api/admin/crm, /quotes,
// /invoices, /service-orders, /commissions, /home). Les montants Prisma
// Decimal arrivent en string.

// Parcours d'un lead (processus v1.3) : Lead enregistré → Attribué (Sales) /
// Pris en charge (OM) → Qualifié → Relance en cours → Visite / visio confirmée
// → Devis envoyé → Confirmé → Paiement confirmé, ou Perdu.
export type LeadStage = 'REGISTERED' | 'ASSIGNED' | 'QUALIFIED' | 'FOLLOW_UP' | 'VISIT_CONFIRMED' | 'QUOTE_SENT' | 'CONFIRMED' | 'PAID' | 'LOST';
export type LeadCircuit = 'SALES_TEAM' | 'OFFICE_MANAGER';
export type LeadPipeline = 'DIGITAL' | 'COMMUNITY' | 'PARTNERS' | 'DIASPORA_DIRECT';
export type LeadChannel =
  | 'LINKEDIN'
  | 'SOCIAL_MEDIA'
  | 'WEBSITE'
  | 'ADVERTISING'
  | 'COLD_MAILING'
  | 'WORKSHOP'
  | 'OPEN_DAY'
  | 'IN_TALK'
  | 'MEMBER_REFERRAL'
  | 'ACCOUNTANT'
  | 'LAWYER'
  | 'SCHOOL'
  | 'INCUBATOR'
  | 'LMIG_SUBSIDIARY'
  | 'DIASPORA_FRANCE'
  | 'DIASPORA_CANADA'
  | 'DIASPORA_UAE'
  | 'WHATSAPP'
  | 'DIRECT_MESSAGE'
  | 'WALK_IN'
  | 'PHONE';
export type LeadKind = 'NEW_BUSINESS' | 'EXTENSION' | 'RENEWAL';
export type LeadPriority = 'COLD' | 'WARM' | 'HOT';
export type LeadSource = 'REGISTRATION' | 'WEBSITE_QUOTE' | 'CONTACT_FORM' | 'MEMBER_SPACE' | 'MEMBER_REFERRAL' | 'AD_FORM' | 'MANUAL';
export type LeadQueue = 'to_dispatch' | 'to_assign' | 'returned' | 'handed_over' | 'to_call' | 'follow_ups_due';
export type ActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'SYSTEM';
export type AppointmentType = 'CALL' | 'VISIT' | 'VIDEO' | 'TRIAL_DAY' | 'MEETING';
export type AppointmentStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED';
export type QuoteStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'CARD';
export type OrderStatus = 'TO_START' | 'IN_PROGRESS' | 'AWAITING_VALIDATION' | 'ADJUSTMENT_REQUESTED' | 'DONE' | 'CANCELLED';
export type DeliveryPole = 'SPACES' | 'COMPANY_CREATION' | 'IN_GROUP';
export type MemberServiceStatus = 'ACTIVATING' | 'AWAITING_VALIDATION' | 'ADJUSTMENT_REQUESTED' | 'ACTIVE' | 'TO_RENEW' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';
export type CommissionStatus = 'PENDING' | 'ELIGIBLE' | 'CHECKED' | 'VALIDATED' | 'PAID' | 'CANCELLED';
export type CommissionBeneficiary = 'CLOSER' | 'OFFICE_MANAGER';
export type MemberDocumentKind = 'CONTRACT' | 'DOMICILIATION_CERTIFICATE' | 'OFFICIAL_DOCUMENT' | 'RECEIPT' | 'OTHER';

export interface StaffUser {
  id: string;
  displayName: string | null;
  email: string;
  role?: string;
  salesProfile?: 'SEDENTARY' | 'FIELD' | null;
  isExternal?: boolean;
}

export interface LeadListItem {
  id: string;
  reference: string;
  title: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: LeadSource;
  kind: LeadKind;
  pipeline: LeadPipeline | null;
  channel: LeadChannel | null;
  channelDetail: string | null;
  circuit: LeadCircuit | null;
  stage: LeadStage;
  priority: LeadPriority | null;
  offerInterest: string | null;
  expectedAmount: string | null;
  nextActionAt: string | null;
  followUpCount: number;
  followUpReturnedAt: string | null;
  handedOverAt: string | null;
  assignedToId: string | null;
  assignedTo: StaffUser | null;
  salesAgentId: string | null;
  salesAgent: StaffUser | null;
  /** Compte membre rattaché ; profile.isPublic = espace déverrouillé. */
  user?: { id: string; profile: { isPublic: boolean } | null } | null;
  updatedAt: string;
  createdAt: string;
  _count: { activities: number; quotes: number; invoices: number };
}

export interface LeadActivity {
  id: string;
  type: ActivityType;
  content: string;
  occurredAt: string;
  author: StaffUser | null;
}

export interface Appointment {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startAt: string;
  endAt: string | null;
  location: string | null;
  notes: string | null;
  assignee: StaffUser | null;
  lead?: { id: string; reference: string; title: string; contactName: string; companyName: string | null };
}

export interface LeadQualification {
  profile?: string | null;
  project?: string | null;
  maturity?: string | null;
  need?: string | null;
  budget?: string | null;
  decisionMaker?: string | null;
  timeline?: string | null;
  notes?: string | null;
}

export interface LeadDetail extends Omit<LeadListItem, '_count' | 'user'> {
  stageLabel: string;
  notes: string | null;
  qualification: LeadQualification | null;
  qualifiedAt: string | null;
  qualifiedBy: StaffUser | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  lostReason: string | null;
  confirmedAt: string | null;
  wonAt: string | null;
  user: { id: string; email: string; referent: StaffUser | null; profile: { isPublic: boolean; firstName: string; lastName: string } | null } | null;
  referrer: { id: string; email: string; profile: { firstName: string; lastName: string } | null } | null;
  parentLead: { id: string; reference: string; title: string; circuit: LeadCircuit | null } | null;
  childLeads: { id: string; reference: string; title: string; kind: LeadKind; stage: LeadStage; createdAt: string }[];
  circuitChanges: { id: string; fromCircuit: LeadCircuit | null; toCircuit: LeadCircuit; reason: string; createdAt: string; author: StaffUser | null }[];
  paymentProofs: AdminProof[];
  serviceRequest: { id: string; notes: string | null; items: { id: string; title: string; tierLabel: string | null; unitPrice: string | null; priceUnit: string | null }[] } | null;
  contactMessage: { id: string; message: string; createdAt: string } | null;
  activities: LeadActivity[];
  appointments: Appointment[];
  quotes: { id: string; number: string; status: QuoteStatus; total: string; validUntil: string | null; createdAt: string }[];
  invoices: { id: string; number: string | null; proformaNumber: string | null; status: InvoiceStatus; total: string; dueDate: string | null; createdAt: string }[];
  serviceOrders: { id: string; title: string; status: OrderStatus; pole: DeliveryPole; expiresAt: string | null }[];
}

export interface DocLine {
  id?: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  /** Remise sur la ligne, en %. */
  discountRate?: number | string;
  serviceId?: string | null;
  planId?: string | null;
  spaceId?: string | null;
  tierLabel?: string | null;
  renewsOrderId?: string | null;
  /** Modèles de devis uniquement : lie la ligne à un service du catalogue. */
  serviceSlug?: string | null;
}

export interface QuoteListItem {
  id: string;
  number: string;
  status: QuoteStatus;
  total: string;
  validUntil: string | null;
  createdAt: string;
  lead: { id: string; reference: string; title: string; contactName: string; companyName: string | null; circuit?: LeadCircuit | null };
}

export interface ApprovalCheck {
  required: boolean;
  approver: 'SALES_MANAGER' | 'DIRECTION' | null;
  reasons: string[];
}

export type DiscountType = 'PERCENT' | 'AMOUNT';

/** Remise sur le total d'un devis / d'une facture ; subtotal = total HT net. */
export interface DocDiscountFields {
  discountType: DiscountType | null;
  discountValue: string;
  /** Total des remises accordées (lignes + total). */
  discountAmount: string;
}

export interface QuoteDetail extends QuoteListItem, DocDiscountFields {
  subtotal: string;
  vatRate: string;
  notes: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedBy: StaffUser | null;
  confirmedVia: 'PLATFORM' | 'EMAIL' | null;
  lines: DocLine[];
  invoices: { id: string; number: string | null; proformaNumber: string | null; status: InvoiceStatus }[];
  lead: QuoteListItem['lead'] & { email: string | null; phone: string | null; userId: string | null };
  approval: ApprovalCheck | null;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  validityDays: number;
  notes: string | null;
  lines: { description: string; quantity?: number; unitPrice: number; serviceSlug?: string; tierLabel?: string }[];
  isActive: boolean;
}

export interface InvoiceListItem {
  id: string;
  number: string | null;
  proformaNumber: string | null;
  status: InvoiceStatus;
  customerName: string;
  customerCompany: string | null;
  total: string;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lead: { id: string; reference: string; circuit?: LeadCircuit | null } | null;
}

export interface InvoiceDetail extends InvoiceListItem, DocDiscountFields {
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerNif: string | null;
  customerRc: string | null;
  customerAi: string | null;
  vatRate: string;
  subtotal: string;
  vatAmount: string;
  notes: string | null;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  lines: DocLine[];
  quote: { id: string; number: string } | null;
  lead: { id: string; reference: string; title: string; userId: string | null; channel: LeadChannel | null } | null;
  serviceOrders: { id: string; title: string; status: OrderStatus }[];
}

export interface OrderTask {
  id: string;
  title: string;
  isDone: boolean;
}

export interface OrderListItem {
  id: string;
  title: string;
  status: OrderStatus;
  pole: DeliveryPole;
  subsidiary: string | null;
  amount: string | null;
  dueAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  readyAt: string | null;
  createdAt: string;
  tasks: { isDone: boolean }[];
  invoice: { number: string | null; proformaNumber: string | null; customerName: string; customerCompany: string | null };
  lead: { id: string; reference: string } | null;
  assignedTo: StaffUser | null;
  user: { id: string; email: string; profile: { firstName: string; lastName: string } | null } | null;
  renewedBy: { id: string } | null;
}

export interface MemberDocument {
  id: string;
  kind: MemberDocumentKind;
  title: string;
  fileName?: string;
  createdAt: string;
  kindLabel?: string;
}

/** Bureau privatif et le service qui l'occupe (GET /api/admin/service-orders/offices). */
export interface OfficeAvailability {
  id: string;
  name: string;
  capacity: number;
  occupiedBy: { orderId: string; title: string; expiresAt: string | null; member: string | null } | null;
}

export interface OrderDetail {
  id: string;
  title: string;
  status: OrderStatus;
  pole: DeliveryPole;
  subsidiary: string | null;
  amount: string | null;
  dueAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  adjustmentNote: string | null;
  notes: string | null;
  tasks: OrderTask[];
  invoice: { id: string; number: string | null; proformaNumber: string | null; customerName: string; customerCompany: string | null; total: string };
  lead: { id: string; reference: string; title: string; kind: LeadKind } | null;
  assignedTo: StaffUser | null;
  validatedBy: StaffUser | null;
  user: { id: string; email: string; referentId: string | null; profile: { firstName: string; lastName: string } | null } | null;
  subscription: { id: string; status: string; startDate: string; endDate: string } | null;
  /** Bureau privatif attribué (location au mois). */
  space: { id: string; name: string; capacity: number } | null;
  renewedFrom: { id: string; title: string; expiresAt: string | null } | null;
  renewedBy: { id: string } | null;
  documents: MemberDocument[];
}

export interface CrmDashboard {
  /** team = tous les leads visibles ; mine = les leads du compte connecté. */
  scope: 'team' | 'mine';
  canManage: boolean;
  kpis: {
    toDispatch: number;
    toAssign: number;
    openLeads: number;
    pipelineAmount: number;
    wonThisMonth: number;
    revenueThisMonth: number;
    conversionRate: number | null;
    overdueActions: number;
    appointmentsToday: number;
    appointmentsWeek: number;
    pendingQuotes: number;
    pendingQuotesAmount: number;
    receivableAmount: number;
    overdueInvoices: number;
    servicesToLaunch: number;
  };
  stages: { stage: LeadStage; label: string; count: number; amount: number }[];
  pipelines: { pipeline: LeadPipeline | null; label: string; count: number }[];
  circuits: { circuit: LeadCircuit | null; label: string; count: number }[];
  assignees: { id: string | null; name: string; count: number }[];
  series: { month: string; leads: number; revenue: number }[];
}

export interface HomeQueue {
  key: string;
  group: 'Prospects' | 'Ventes' | 'Clients' | 'Commissions';
  label: string;
  hint: string;
  count: number;
  href: string;
  alert?: boolean;
}

export interface PilotageKpi {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  target: string;
  status: 'good' | 'watch' | 'info';
  detail?: string;
}

export interface HomeData {
  role: string;
  roleLabel: string;
  queues: HomeQueue[];
  agenda: (Appointment & { overdue: boolean })[];
  myMembers: number;
  kpis: PilotageKpi[] | null;
}

export interface Commission {
  id: string;
  role: CommissionBeneficiary;
  description: string;
  baseAmount: string;
  amount: string;
  status: CommissionStatus;
  createdAt: string;
  checkedAt: string | null;
  validatedAt: string | null;
  paidAt: string | null;
  note: string | null;
  beneficiary: StaffUser;
  lead: { id: string; reference: string; title: string; contactName: string; companyName: string | null; circuit: LeadCircuit | null } | null;
  invoice: { id: string; number: string | null; paidAt: string | null };
  order: { id: string; title: string; status: OrderStatus } | null;
}

export interface CommissionRule {
  id: string;
  beneficiary: CommissionBeneficiary;
  serviceId: string | null;
  planId: string | null;
  category: string | null;
  leadKind: LeadKind | null;
  circuit: LeadCircuit | null;
  mode: 'RATE' | 'FIXED';
  value: string;
  isActive: boolean;
  service: { id: string; title: string } | null;
  plan: { id: string; name: string } | null;
}

export interface SearchResults {
  leads: { id: string; reference: string; title: string; contactName: string; stage: LeadStage; circuit: LeadCircuit | null }[];
  quotes: { id: string; number: string; status: QuoteStatus; total: string; lead: { contactName: string } }[];
  invoices: { id: string; number: string | null; proformaNumber: string | null; status: InvoiceStatus; total: string; customerName: string }[];
}
