import type { InvoiceStatus, QuoteStatus } from './crm';

// « Situation du compte » (GET /api/member/situation) — ce que voit un membre
// tant que son compte n'a pas été validé par l'équipe. Les montants (Decimal)
// arrivent sérialisés en chaînes.

export type PaymentProofStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface SituationQuoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface SituationQuote {
  id: string;
  number: string;
  status: QuoteStatus;
  subtotal: string;
  total: string;
  vatRate: string;
  validUntil: string | null;
  sentAt: string | null;
  notes: string | null;
  lines: SituationQuoteLine[];
}

export interface SituationInvoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  total: string;
  dueDate: string | null;
  paidAt: string | null;
}

export interface SituationRequest {
  id: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  createdAt: string;
  items: { id: string; title: string; tierLabel: string | null }[];
}

export interface SituationProof {
  id: string;
  status: PaymentProofStatus;
  fileName: string;
  mimeType: string;
  amount: string | null;
  reference: string | null;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  quote: { number: string } | null;
  invoice: { number: string } | null;
}

export interface Situation {
  validated: boolean;
  account: {
    email: string;
    name: string | null;
    isCompany: boolean;
    companyName: string | null;
    seatLimit: number | null;
  };
  completeness: { isComplete: boolean; missing: string[] };
  requests: SituationRequest[];
  quotes: SituationQuote[];
  invoices: SituationInvoice[];
  proofs: SituationProof[];
  paymentInstructions: { holder: string; rib: string | null };
}
