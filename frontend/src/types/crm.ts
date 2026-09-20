import type { AdminProof } from '@/components/admin/PaymentProofs';
// Types du CRM commercial (miroir des réponses de /api/admin/crm, /quotes,
// /invoices, /service-orders). Les montants Prisma Decimal arrivent en string.

export type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'QUOTE_SENT' | 'WON' | 'LOST';
export type LeadSource = 'REGISTRATION' | 'WEBSITE_QUOTE' | 'CONTACT_FORM' | 'PHONE' | 'VISIT' | 'REFERRAL' | 'EVENT' | 'OTHER';
export type ActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'SYSTEM';
export type AppointmentType = 'CALL' | 'VISIT' | 'MEETING';
export type AppointmentStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'CARD';
export type OrderStatus = 'TO_START' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface StaffUser {
  id: string;
  displayName: string | null;
  email: string;
  role?: string;
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
  stage: LeadStage;
  expectedAmount: string | null;
  nextActionAt: string | null;
  assignedToId: string | null;
  assignedTo: StaffUser | null;
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

export interface LeadDetail extends Omit<LeadListItem, '_count'> {
  notes: string | null;
  lostReason: string | null;
  wonAt: string | null;
  user: { id: string; email: string; profile: { isPublic: boolean } | null } | null;
  paymentProofs: AdminProof[];
  serviceRequest: { id: string; notes: string | null; items: { id: string; title: string; tierLabel: string | null; unitPrice: string | null; priceUnit: string | null }[] } | null;
  activities: LeadActivity[];
  appointments: Appointment[];
  quotes: { id: string; number: string; status: QuoteStatus; total: string; validUntil: string | null; createdAt: string }[];
  invoices: { id: string; number: string | null; status: InvoiceStatus; total: string; dueDate: string | null; createdAt: string }[];
  serviceOrders: { id: string; title: string; status: OrderStatus }[];
}

export interface DocLine {
  id?: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  serviceId?: string | null;
  planId?: string | null;
  spaceId?: string | null;
  tierLabel?: string | null;
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
  lead: { id: string; reference: string; title: string; contactName: string; companyName: string | null };
}

export interface QuoteDetail extends QuoteListItem {
  subtotal: string;
  vatRate: string;
  notes: string | null;
  sentAt: string | null;
  lines: DocLine[];
  invoices: { id: string; number: string | null; status: InvoiceStatus }[];
  lead: QuoteListItem['lead'] & { email: string | null; phone: string | null };
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
  status: InvoiceStatus;
  customerName: string;
  customerCompany: string | null;
  total: string;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lead: { id: string; reference: string } | null;
}

export interface InvoiceDetail extends InvoiceListItem {
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
  lines: DocLine[];
  quote: { id: string; number: string } | null;
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
  dueAt: string | null;
  createdAt: string;
  tasks: { isDone: boolean }[];
  invoice: { number: string | null; customerName: string; customerCompany: string | null };
  lead: { id: string; reference: string } | null;
  assignedTo: StaffUser | null;
}

export interface OrderDetail {
  id: string;
  title: string;
  status: OrderStatus;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  tasks: OrderTask[];
  invoice: { id: string; number: string | null; customerName: string; customerCompany: string | null; total: string };
  lead: { id: string; reference: string; title: string } | null;
  assignedTo: StaffUser | null;
  user: { id: string; email: string } | null;
  subscription: { id: string; status: string; startDate: string; endDate: string } | null;
}

export interface CrmDashboard {
  kpis: {
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
  sources: { source: LeadSource; count: number }[];
  assignees: { id: string | null; name: string; count: number }[];
  series: { month: string; leads: number; revenue: number }[];
}

export interface SearchResults {
  leads: { id: string; reference: string; title: string; contactName: string; stage: LeadStage }[];
  quotes: { id: string; number: string; status: QuoteStatus; total: string; lead: { contactName: string } }[];
  invoices: { id: string; number: string | null; status: InvoiceStatus; total: string; customerName: string }[];
}
