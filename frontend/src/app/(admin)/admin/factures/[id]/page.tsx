'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, FileDown, Mail, Send, Trash2, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { LineItemsEditor } from '@/components/admin/LineItemsEditor';
import { errorMessage, Field, InvoiceBadge, OrderBadge, Pill } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, INVOICE_STATUS, money, openAdminPdf, PAYMENT_LABEL, toInputDate } from '@/lib/crm';
import { HUE_ACCENT } from '@/lib/palette';
import type { DocLine, InvoiceDetail, PaymentMethod } from '@/types/crm';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<{ data: InvoiceDetail }>(`/api/admin/invoices/${id}`).then((r) => r.data),
  });
  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!invoice) return <EmptyState title="Facture introuvable" />;
  return <InvoiceEditor key={invoice.id} invoice={invoice} />;
}

function InvoiceEditor({ invoice }: { invoice: InvoiceDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editable = invoice.status === 'DRAFT';
  const [form, setForm] = useState({
    customerName: invoice.customerName,
    customerCompany: invoice.customerCompany ?? '',
    customerEmail: invoice.customerEmail ?? '',
    customerPhone: invoice.customerPhone ?? '',
    customerAddress: invoice.customerAddress ?? '',
    customerNif: invoice.customerNif ?? '',
    customerRc: invoice.customerRc ?? '',
    customerAi: invoice.customerAi ?? '',
    dueDate: toInputDate(invoice.dueDate),
    vatRate: String(Number(invoice.vatRate)),
    notes: invoice.notes ?? '',
    sendOnIssue: Boolean(invoice.customerEmail),
  });
  const [lines, setLines] = useState<DocLine[]>(invoice.lines.map((l) => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pay, setPay] = useState({ method: 'BANK_TRANSFER' as PaymentMethod, paidAt: toInputDate(new Date()), reference: '' });
  const [reason, setReason] = useState('');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['service-orders'] });
  };
  const fail = (e: unknown) => {
    setNotice(null);
    setError(errorMessage(e));
  };

  const draftBody = () => ({
    customerName: form.customerName,
    customerCompany: form.customerCompany,
    customerEmail: form.customerEmail,
    customerPhone: form.customerPhone,
    customerAddress: form.customerAddress,
    customerNif: form.customerNif,
    customerRc: form.customerRc,
    customerAi: form.customerAi,
    dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : null,
    vatRate: Number(form.vatRate) || 0,
    notes: form.notes,
    lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, serviceId: l.serviceId, planId: l.planId, spaceId: l.spaceId, tierLabel: l.tierLabel })),
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/invoices/${invoice.id}`, draftBody()),
    onSuccess: () => {
      setError(null);
      setNotice('Brouillon enregistré.');
      refresh();
    },
    onError: fail,
  });
  const issue = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/admin/invoices/${invoice.id}`, draftBody());
      return api.post<{ data: { invoice: InvoiceDetail; emailed: boolean; emailError?: string } }>(`/api/admin/invoices/${invoice.id}/issue`, { send: form.sendOnIssue && Boolean(form.customerEmail), dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : undefined }).then((r) => r.data);
    },
    onSuccess: (r) => {
      setError(null);
      set({ dueDate: toInputDate(r.invoice.dueDate) });
      setNotice(`Facture ${r.invoice.number} émise${r.emailed ? ' et envoyée au client' : r.emailError && form.sendOnIssue ? ` (email non envoyé : ${r.emailError})` : ''}.`);
      refresh();
    },
    onError: fail,
  });
  const resend = useMutation({
    mutationFn: () => api.post<{ data: { emailed: boolean; emailError?: string } }>(`/api/admin/invoices/${invoice.id}/send`).then((r) => r.data),
    onSuccess: (r) => {
      setError(null);
      setNotice(r.emailed ? `Facture envoyée à ${invoice.customerEmail}.` : `Envoi impossible : ${r.emailError}`);
      refresh();
    },
    onError: fail,
  });
  const recordPayment = useMutation({
    mutationFn: () =>
      api.post<{ data: { orders: unknown[] } }>(`/api/admin/invoices/${invoice.id}/payment`, {
        method: pay.method,
        paidAt: pay.paidAt ? new Date(`${pay.paidAt}T12:00:00`).toISOString() : undefined,
        reference: pay.reference,
      }).then((r) => r.data),
    onSuccess: (r) => {
      setPayOpen(false);
      setError(null);
      setNotice(`Paiement enregistré : ${r.orders.length} service${r.orders.length > 1 ? 's' : ''} à lancer.`);
      refresh();
    },
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/api/admin/invoices/${invoice.id}/cancel`, { reason }),
    onSuccess: () => {
      setCancelOpen(false);
      setError(null);
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/invoices/${invoice.id}`),
    onSuccess: () => router.push('/admin/factures'),
    onError: fail,
  });

  const busy = save.isPending || issue.isPending || resend.isPending || recordPayment.isPending || cancel.isPending || remove.isPending;
  const overdue = invoice.status === 'SENT' && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/factures" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Factures
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-ink-900">{invoice.number ?? 'Facture (brouillon)'}</h1>
              <InvoiceBadge status={invoice.status} />
              {overdue && <Pill tone="red">En retard</Pill>}
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {invoice.lead && (
                <Link href={`/admin/crm/leads/${invoice.lead.id}`} className="font-medium text-brand-blue hover:underline">
                  {invoice.lead.reference}
                </Link>
              )}
              {invoice.quote && (
                <>
                  {' · '}
                  <Link href={`/admin/devis/${invoice.quote.id}`} className="font-medium text-brand-blue hover:underline">
                    {invoice.quote.number}
                  </Link>
                </>
              )}
              {invoice.issueDate && ` · émise le ${dateFr(invoice.issueDate)}`}
              {invoice.dueDate && invoice.status === 'SENT' && ` · échéance ${dateFr(invoice.dueDate)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => openAdminPdf(`/api/admin/invoices/${invoice.id}/pdf`).catch(fail)}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            {editable && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => save.mutate()}>
                  {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button disabled={busy || lines.length === 0} onClick={() => issue.mutate()}>
                  <Send className="h-4 w-4" /> Émettre la facture
                </Button>
              </>
            )}
            {invoice.status === 'SENT' && (
              <Button disabled={busy} onClick={() => setPayOpen(true)}>
                <Banknote className="h-4 w-4" /> Enregistrer le paiement
              </Button>
            )}
            {(invoice.status === 'SENT' || invoice.status === 'PAID') && invoice.customerEmail && (
              <Button variant="outline" disabled={busy} onClick={() => resend.mutate()}>
                <Mail className="h-4 w-4" /> Envoyer par email
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

      <Card accent={HUE_ACCENT[INVOICE_STATUS[invoice.status].tone]}>
        <CardContent className="space-y-4">
          <h2 className="font-heading text-base font-bold text-ink-900">Client</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nom *" htmlFor="c-name">
              <Input id="c-name" disabled={!editable} value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} />
            </Field>
            <Field label="Entreprise" htmlFor="c-company">
              <Input id="c-company" disabled={!editable} value={form.customerCompany} onChange={(e) => set({ customerCompany: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="c-email">
              <Input id="c-email" type="email" disabled={!editable} value={form.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} />
            </Field>
            <Field label="Téléphone" htmlFor="c-phone">
              <Input id="c-phone" disabled={!editable} value={form.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} />
            </Field>
            <Field label="Adresse" htmlFor="c-address" className="sm:col-span-2">
              <Input id="c-address" disabled={!editable} value={form.customerAddress} onChange={(e) => set({ customerAddress: e.target.value })} />
            </Field>
            <Field label="NIF" htmlFor="c-nif">
              <Input id="c-nif" disabled={!editable} value={form.customerNif} onChange={(e) => set({ customerNif: e.target.value })} />
            </Field>
            <Field label="RC" htmlFor="c-rc">
              <Input id="c-rc" disabled={!editable} value={form.customerRc} onChange={(e) => set({ customerRc: e.target.value })} />
            </Field>
            <Field label="AI" htmlFor="c-ai">
              <Input id="c-ai" disabled={!editable} value={form.customerAi} onChange={(e) => set({ customerAi: e.target.value })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Échéance de paiement" htmlFor="i-due">
              <Input id="i-due" type="date" disabled={!editable} value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              {editable && <p className="mt-1 text-xs text-ink-500">Par défaut : 30 jours après l’émission.</p>}
            </Field>
            <Field label="TVA (%)" htmlFor="i-vat">
              <Input id="i-vat" type="number" min="0" max="100" step="0.01" disabled={!editable} value={form.vatRate} onChange={(e) => set({ vatRate: e.target.value })} />
            </Field>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} vatRate={Number(form.vatRate) || 0} readOnly={!editable} />
          <Field label="Notes (reprises sur le PDF)" htmlFor="i-notes">
            <Textarea id="i-notes" rows={2} disabled={!editable} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          {editable && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/8 pt-4">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.sendOnIssue} disabled={!form.customerEmail} onChange={(e) => set({ sendOnIssue: e.target.checked })} />
                Envoyer la facture par email au client à l’émission
                {!form.customerEmail && <span className="text-xs text-ink-400">(pas d’adresse email)</span>}
              </label>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => window.confirm('Supprimer ce brouillon ?') && remove.mutate()}>
                <Trash2 className="h-4 w-4" /> Supprimer le brouillon
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {invoice.status === 'PAID' && (
        <Card accent="green">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Paiement et lancement des services</h2>
            <p className="text-sm text-ink-700">
              Payée le {dateFr(invoice.paidAt)} par {invoice.paymentMethod ? PAYMENT_LABEL[invoice.paymentMethod].toLowerCase() : '—'}
              {invoice.paymentRef ? ` (réf. ${invoice.paymentRef})` : ''}.
            </p>
            <ul className="space-y-1.5">
              {invoice.serviceOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm">
                  <span className="text-ink-800">{o.title}</span>
                  <OrderBadge status={o.status} />
                </li>
              ))}
            </ul>
            <Link href="/admin/lancements" className="text-sm font-medium text-brand-blue hover:underline">
              Suivre les lancements →
            </Link>
          </CardContent>
        </Card>
      )}

      {invoice.status === 'SENT' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCancelOpen(true)}>
            <Ban className="h-4 w-4" /> Annuler cette facture
          </Button>
        </div>
      )}

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Paiement de ${money(invoice.total)}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Annuler
            </Button>
            <Button disabled={recordPayment.isPending} onClick={() => recordPayment.mutate()}>
              {recordPayment.isPending ? 'Enregistrement…' : 'Confirmer le paiement'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Mode de paiement" htmlFor="pay-method">
            <Select id="pay-method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date de réception" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} />
          </Field>
          <Field label="Référence (n° de virement, de chèque…)" htmlFor="pay-ref">
            <Input id="pay-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </Field>
          <p className="text-xs text-ink-500">Le paiement lance automatiquement les services facturés et active l’abonnement du membre rattaché.</p>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler la facture"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Retour
            </Button>
            <Button disabled={cancel.isPending || reason.trim().length < 2} onClick={() => cancel.mutate()}>
              Annuler la facture
            </Button>
          </>
        }
      >
        <Field label="Motif" htmlFor="cancel-reason">
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </div>
  );
}
