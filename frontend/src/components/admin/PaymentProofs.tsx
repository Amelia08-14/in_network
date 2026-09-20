'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, Pill } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, money, openAdminPdf, type Tone } from '@/lib/crm';
import type { PaymentProofStatus } from '@/types/situation';

// Justificatifs de paiement envoyés par les membres depuis « Situation du
// compte » : consultation du fichier, acceptation (avec enregistrement du
// paiement et validation du compte en option) ou refus motivé.

export interface AdminProof {
  id: string;
  status: PaymentProofStatus;
  fileName: string;
  amount: string | null;
  reference: string | null;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  quote: { number: string } | null;
  invoice: { number: string | null; status?: string } | null;
  // Présent dans la file globale (/admin/validations), absent sur la fiche lead.
  user?: { id: string; email: string; profile: { firstName: string; lastName: string; isPublic: boolean } | null };
}

const STATUS: Record<PaymentProofStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'À vérifier', tone: 'amber' },
  ACCEPTED: { label: 'Accepté', tone: 'green' },
  REJECTED: { label: 'Refusé', tone: 'red' },
};

export function ProofList({
  proofs,
  accountValidated,
  onChanged,
  showMember,
}: {
  proofs: AdminProof[];
  /** Compte du membre déjà validé ? (masque l'option « Valider aussi le compte »). */
  accountValidated?: boolean;
  onChanged: () => void;
  showMember?: boolean;
}) {
  const [review, setReview] = useState<{ proof: AdminProof; decision: 'ACCEPT' | 'REJECT' } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function openFile(id: string) {
    setFileError(null);
    try {
      await openAdminPdf(`/api/admin/payment-proofs/${id}/file`);
    } catch (error) {
      setFileError(errorMessage(error));
    }
  }

  return (
    <>
      {fileError && <p role="alert" className="mb-2 text-xs text-red-600">{fileError}</p>}
      <ul className="space-y-2">
        {proofs.map((proof) => {
          const status = STATUS[proof.status];
          const member = proof.user?.profile ? `${proof.user.profile.firstName} ${proof.user.profile.lastName}` : proof.user?.email;
          return (
            <li key={proof.id} className="rounded-xl border border-ink-900/10 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Pill tone={status.tone}>{status.label}</Pill>
                {showMember && member && <span className="font-medium text-ink-900">{member}</span>}
                <span className="min-w-0 truncate text-ink-700">{proof.fileName}</span>
                <span className="text-xs text-ink-500">
                  {dateFr(proof.createdAt)}
                  {proof.amount ? ` · ${money(proof.amount)}` : ''}
                  {proof.reference ? ` · réf. ${proof.reference}` : ''}
                  {proof.invoice?.number ? ` · facture ${proof.invoice.number}` : proof.quote ? ` · devis ${proof.quote.number}` : ''}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openFile(proof.id)}>
                  <FileText className="h-4 w-4" /> Voir
                </Button>
              </div>
              {proof.note && <p className="mt-2 rounded-lg bg-ink-900/[0.04] px-3 py-2 text-xs text-ink-700">« {proof.note} »</p>}
              {proof.status === 'REJECTED' && proof.reviewNote && <p className="mt-2 text-xs text-red-700">Motif du refus : {proof.reviewNote}</p>}
              {proof.status === 'PENDING' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setReview({ proof, decision: 'ACCEPT' })}>
                    <CheckCircle2 className="h-4 w-4" /> Accepter
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReview({ proof, decision: 'REJECT' })}>
                    <XCircle className="h-4 w-4" /> Refuser
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {review && (
        <ReviewModal
          key={`${review.proof.id}-${review.decision}`}
          proof={review.proof}
          decision={review.decision}
          accountValidated={accountValidated ?? review.proof.user?.profile?.isPublic ?? false}
          onClose={() => setReview(null)}
          onDone={() => {
            setReview(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ReviewModal({
  proof,
  decision,
  accountValidated,
  onClose,
  onDone,
}: {
  proof: AdminProof;
  decision: 'ACCEPT' | 'REJECT';
  accountValidated: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const canRecordPayment = Boolean(proof.invoice) && proof.invoice?.status !== 'PAID';
  const [recordPayment, setRecordPayment] = useState(canRecordPayment);
  const [validateAccount, setValidateAccount] = useState(!accountValidated);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/payment-proofs/${proof.id}/review`, {
        decision,
        ...(decision === 'REJECT' ? { reviewNote: reason } : { recordPayment: canRecordPayment && recordPayment, validateAccount: !accountValidated && validateAccount }),
      }),
    onSuccess: onDone,
    onError: (e) => setError(errorMessage(e)),
  });

  const accepting = decision === 'ACCEPT';
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={accepting ? 'Accepter le justificatif' : 'Refuser le justificatif'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={submit.isPending || (!accepting && !reason.trim())} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {accepting ? 'Confirmer' : 'Refuser'}
          </Button>
        </>
      }
    >
      {accepting ? (
        <div className="space-y-3 text-sm text-ink-700">
          <p>
            Le client sera prévenu. {proof.amount ? `Montant indiqué : ${money(proof.amount)}.` : ''}
          </p>
          {canRecordPayment && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-orange" checked={recordPayment} onChange={(e) => setRecordPayment(e.target.checked)} />
              <span>
                <span className="font-medium text-ink-900">Enregistrer le paiement</span> de la facture {proof.invoice?.number} (virement) et lancer les services associés.
              </span>
            </label>
          )}
          {!accountValidated && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-orange" checked={validateAccount} onChange={(e) => setValidateAccount(e.target.checked)} />
              <span>
                <span className="inline-flex items-center gap-1 font-medium text-ink-900">
                  <ShieldCheck className="h-4 w-4 text-green-700" /> Valider aussi le compte
                </span>{' '}
                : déverrouille tout l’espace membre.
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="proof-reject-reason" className="block text-sm font-medium text-ink-700">
            Motif du refus (visible par le client)
          </label>
          <Textarea id="proof-reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reçu illisible, montant différent, référence manquante…" autoFocus />
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}

/** Bouton « Valider le compte » (PATCH approve) — sans justificatif. */
export function ApproveAccountButton({ userId, onDone, size = 'sm' }: { userId: string; onDone: () => void; size?: 'sm' | 'md' }) {
  const [error, setError] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: () => api.patch(`/api/admin/members/${userId}/approve`),
    onSuccess: onDone,
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size={size} disabled={approve.isPending} onClick={() => approve.mutate()}>
        {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Valider le compte
      </Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
