'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileDown, Mail, Receipt, ShieldCheck, Undo2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { LineItemsEditor } from '@/components/admin/LineItemsEditor';
import { errorMessage, Field, InvoiceBadge, QuoteBadge, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateTimeFr, invoiceNumber, openAdminPdf, QUOTE_STATUS, staffName, toInputDate, type DocDiscountInput } from '@/lib/crm';
import { HUE_ACCENT } from '@/lib/palette';
import type { DocLine, QuoteDetail } from '@/types/crm';

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => api.get<{ data: QuoteDetail }>(`/api/admin/quotes/${id}`).then((r) => r.data),
  });
  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!quote) return <EmptyState title="Devis introuvable" />;
  // Le formulaire est monté une fois le devis chargé : son état local part des
  // valeurs enregistrées (et repart à zéro si l'on change de devis).
  return <QuoteEditor key={quote.id} quote={quote} />;
}

// Devis (phase 3 du processus v1.3). À tarif défini, il part directement ;
// sinon c'est une demande de devis, validée par le responsable commercial
// (circuit 1) ou la Direction (circuit 2, ou au-delà du seuil) avant l'envoi.
// Une fois envoyé, le client le confirme depuis son espace, ou par e-mail
// (l'intervenant le consigne ici) ; la proforma suit.
function QuoteEditor({ quote }: { quote: QuoteDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useCrmAccess();
  const editable = quote.status === 'DRAFT';
  const approval = quote.approval;
  const needsApproval = editable && Boolean(approval?.required) && !quote.approvedAt;
  const canApprove = access.direction || (approval?.approver === 'SALES_MANAGER' && access.salesManager);
  const [returnComment, setReturnComment] = useState('');
  const [lines, setLines] = useState<DocLine[]>(quote.lines.map((l) => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountRate: Number(l.discountRate ?? 0) })));
  const [discount, setDiscount] = useState<DocDiscountInput>({ type: quote.discountType, value: Number(quote.discountValue) });
  const [validUntil, setValidUntil] = useState(toInputDate(quote.validUntil));
  const [vatRate, setVatRate] = useState(String(Number(quote.vatRate)));
  const [notes, setNotes] = useState(quote.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
  };
  const fail = (e: unknown) => {
    setNotice(null);
    setError(errorMessage(e));
  };

  const body = () => ({
    validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
    vatRate: Number(vatRate) || 0,
    notes,
    discountType: discount.type,
    discountValue: discount.type ? Number(discount.value) || 0 : 0,
    lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, discountRate: Number(l.discountRate) || 0, serviceId: l.serviceId, planId: l.planId, spaceId: l.spaceId, tierLabel: l.tierLabel, renewsOrderId: l.renewsOrderId })),
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/quotes/${quote.id}`, body()),
    onSuccess: () => {
      setError(null);
      setNotice('Devis enregistré.');
      refresh();
    },
    onError: fail,
  });
  const send = useMutation({
    mutationFn: async () => {
      if (editable) await api.patch(`/api/admin/quotes/${quote.id}`, body());
      return api.post<{ data: { emailed: boolean; emailError?: string } }>(`/api/admin/quotes/${quote.id}/send`).then((r) => r.data);
    },
    onSuccess: (result) => {
      setError(null);
      setNotice(result.emailed ? `Devis envoyé à ${quote.lead.email}.` : result.emailError ? `Devis marqué comme envoyé, mais l’email a échoué (${result.emailError}).` : 'Devis marqué comme envoyé — aucune adresse email sur le lead, à remettre en main propre.');
      refresh();
    },
    onError: fail,
  });
  const submit = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/admin/quotes/${quote.id}`, body());
      return api.post(`/api/admin/quotes/${quote.id}/submit`);
    },
    onSuccess: () => {
      setError(null);
      setNotice('Devis soumis à validation.');
      refresh();
    },
    onError: fail,
  });
  const approve = useMutation({
    mutationFn: () => api.post<{ data: { emailed: boolean; emailError?: string } }>(`/api/admin/quotes/${quote.id}/approve`).then((r) => r.data),
    onSuccess: (result) => {
      setError(null);
      setNotice(result.emailed ? `Devis validé et envoyé à ${quote.lead.email}.` : 'Devis validé et marqué comme envoyé.');
      refresh();
    },
    onError: fail,
  });
  const sendBack = useMutation({
    mutationFn: () => api.post(`/api/admin/quotes/${quote.id}/return`, { comment: returnComment }),
    onSuccess: () => {
      setError(null);
      setNotice('Devis renvoyé à son auteur.');
      setReturnComment('');
      refresh();
    },
    onError: fail,
  });
  const act = useMutation({
    mutationFn: (action: 'accept' | 'reject' | 'reopen') => api.post(`/api/admin/quotes/${quote.id}/${action}`),
    onSuccess: () => {
      setError(null);
      setNotice(null);
      refresh();
    },
    onError: fail,
  });
  const toInvoice = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/admin/invoices', { quoteId: quote.id }).then((r) => r.data),
    onSuccess: (invoice) => router.push(`/admin/factures/${invoice.id}`),
    onError: fail,
  });

  const activeInvoice = quote.invoices.find((i) => i.status !== 'CANCELLED');
  const unpriced = lines.some((l) => Number(l.unitPrice) <= 0);
  const busy = save.isPending || send.isPending || act.isPending || toInvoice.isPending || submit.isPending || approve.isPending || sendBack.isPending;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/devis" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Devis
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-ink-900">{quote.number}</h1>
              <QuoteBadge status={quote.status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">
              <Link href={`/admin/crm/leads/${quote.lead.id}`} className="font-medium text-brand-blue hover:underline">
                {quote.lead.reference} — {quote.lead.title}
              </Link>{' '}
              · {quote.lead.companyName || quote.lead.contactName}
              {quote.lead.email ? ` · ${quote.lead.email}` : ' · pas d’email'}
            </p>
            {quote.sentAt && <p className="text-xs text-ink-400">Envoyé le {dateTimeFr(quote.sentAt)}</p>}
            {quote.approvedAt && <p className="text-xs text-ink-400">Validé par {staffName(quote.approvedBy)} le {dateTimeFr(quote.approvedAt)}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => openAdminPdf(`/api/admin/quotes/${quote.id}/pdf`).catch(fail)}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            {editable && (
              <Button variant="outline" disabled={busy} onClick={() => save.mutate()}>
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            )}
            {needsApproval && (
              <Button disabled={busy || lines.length === 0} onClick={() => submit.mutate()}>
                <ShieldCheck className="h-4 w-4" /> Soumettre à validation
              </Button>
            )}
            {((editable && !needsApproval) || quote.status === 'SENT') && (
              <Button disabled={busy || lines.length === 0} onClick={() => send.mutate()}>
                <Mail className="h-4 w-4" /> {quote.status === 'SENT' ? 'Renvoyer au client' : 'Envoyer au client'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-accent-green/15 px-4 py-2.5 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      {editable && unpriced && lines.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Certaines lignes n’ont pas de prix (prestations sur devis) : chiffrez-les avant l’envoi.</p>
      )}
      {needsApproval && approval && (
        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Demande de devis à faire valider par {approval.approver === 'DIRECTION' ? 'la Direction' : 'le responsable commercial'} avant l’envoi : {approval.reasons.join(', ')}. Enregistrez vos modifications pour mettre ce contrôle à jour.
        </p>
      )}
      {quote.status === 'PENDING_APPROVAL' && (
        <Card accent="yellow">
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
              <ShieldCheck className="h-4 w-4 text-amber-700" /> Validation {approval?.approver === 'DIRECTION' ? 'de la Direction' : 'du responsable commercial'}
            </h2>
            {approval && <p className="text-sm text-ink-600">Motifs : {approval.reasons.join(', ')}.</p>}
            {canApprove ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => approve.mutate()}>
                    <Check className="h-4 w-4" /> Valider et envoyer au client
                  </Button>
                </div>
                <Field label="Ou renvoyer pour modification" htmlFor="q-return">
                  <div className="flex flex-wrap gap-2">
                    <Input id="q-return" className="min-w-64 flex-1" value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="Ce qui doit être revu" />
                    <Button variant="outline" disabled={busy || returnComment.trim().length < 3} onClick={() => sendBack.mutate()}>
                      <Undo2 className="h-4 w-4" /> Renvoyer
                    </Button>
                  </div>
                </Field>
              </>
            ) : (
              <p className="text-sm text-ink-500">En attente de validation. Vous serez prévenu dès que le devis sera validé et envoyé, ou renvoyé avec un commentaire.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card accent={HUE_ACCENT[QUOTE_STATUS[quote.status].tone]}>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valable jusqu’au" htmlFor="q-valid">
              <Input id="q-valid" type="date" disabled={!editable} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
            <Field label="TVA (%)" htmlFor="q-vat">
              <Input id="q-vat" type="number" min="0" max="100" step="0.01" disabled={!editable} value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </Field>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} vatRate={Number(vatRate) || 0} readOnly={!editable} discount={discount} onDiscountChange={setDiscount} catalogue locked={!access.direction} />
          <Field label="Notes et conditions (reprises sur le PDF)" htmlFor="q-notes">
            <Textarea id="q-notes" rows={3} disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Modalités de paiement, délais, périmètre…" />
          </Field>
        </CardContent>
      </Card>

      <Card accent="orange">
        <CardContent className="space-y-3">
          <h2 className="font-heading text-base font-bold text-ink-900">Suite commerciale</h2>
          {quote.status === 'DRAFT' && <p className="text-sm text-ink-600">Vérifiez les lignes puis envoyez le devis : le client reçoit le PDF par e-mail{quote.lead.userId ? ' et peut le confirmer depuis son espace' : ''}, le lead passe à « Devis envoyé ». Sans réponse, il est relancé automatiquement.</p>}
          {quote.status === 'PENDING_APPROVAL' && <p className="text-sm text-ink-600">Le devis part au client dès sa validation.</p>}
          {quote.status === 'SENT' && (
            <>
              <p className="text-sm text-ink-600">En attente de la réponse du client{quote.lead.userId ? ', qui peut confirmer depuis son espace' : ''}. S’il confirme par e-mail ou par téléphone, consignez-le :</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => act.mutate('accept')}>
                  <Check className="h-4 w-4" /> Confirmé par le client
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => act.mutate('reject')}>
                  <X className="h-4 w-4" /> Marquer refusé
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => act.mutate('reopen')}>
                  <Undo2 className="h-4 w-4" /> Repasser en brouillon
                </Button>
              </div>
            </>
          )}
          {quote.status === 'ACCEPTED' &&
            (activeInvoice ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
                Proforma associée :
                <Link href={`/admin/factures/${activeInvoice.id}`} className="inline-flex items-center gap-2 font-medium text-brand-blue hover:underline">
                  {invoiceNumber(activeInvoice)} <InvoiceBadge status={activeInvoice.status} />
                </Link>
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-600">
                  Devis confirmé{quote.confirmedVia === 'PLATFORM' ? ' par le client depuis son espace' : ''} : appelez le client pour organiser le paiement et préparez la facture proforma (elle reprend les lignes du devis).
                </p>
                <Button disabled={busy} onClick={() => toInvoice.mutate()}>
                  <Receipt className="h-4 w-4" /> Préparer la proforma
                </Button>
              </>
            ))}
          {(quote.status === 'REJECTED' || quote.status === 'EXPIRED') && (
            <>
              <p className="text-sm text-ink-600">{quote.status === 'REJECTED' ? 'Le client a refusé ce devis.' : 'La validité de ce devis est dépassée.'} Vous pouvez le rouvrir pour l’ajuster et le renvoyer.</p>
              <Button variant="outline" disabled={busy} onClick={() => act.mutate('reopen')}>
                <Undo2 className="h-4 w-4" /> Repasser en brouillon
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
