import type { InvoiceStatus, QuoteStatus } from './crm';

// « Devis et factures » (GET /api/member/situation) : demandes, devis,
// proformas, factures et justificatifs du membre. Les montants (Decimal)
// arrivent sérialisés en chaînes.

export type PaymentProofStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface SituationQuoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
}

export interface SituationQuote {
  id: string;
  number: string;
  status: QuoteStatus;
  /** Total HT net (remises déduites). */
  subtotal: string;
  /** Total des remises accordées ; « 0.00 » = aucune. */
  discountAmount: string;
  /** Remise sur le total : en % ou en montant HT. */
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: string;
  total: string;
  vatRate: string;
  validUntil: string | null;
  sentAt: string | null;
  notes: string | null;
  lines: SituationQuoteLine[];
}

export interface SituationInvoice {
  id: string;
  /** Numéro de facture définitive, attribué au paiement. */
  number: string | null;
  /** Numéro de la proforma (avant paiement). */
  proformaNumber: string | null;
  status: InvoiceStatus;
  total: string;
  dueDate: string | null;
  paidAt: string | null;
}

/** Où en est la demande : chiffrage, devis reçu, devis confirmé, traitée, sans suite. */
export type RequestProgress = 'PRICING' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'DONE' | 'CLOSED';

export interface SituationRequest {
  id: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  progress: RequestProgress;
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
  invoice: { number: string | null; proformaNumber: string | null } | null;
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
