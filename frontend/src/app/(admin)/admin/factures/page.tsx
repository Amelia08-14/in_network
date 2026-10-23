'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ProofList, type AdminProof } from '@/components/admin/PaymentProofs';
import { InvoiceBadge, Kpi, PageTitle, Pill } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, INVOICE_STATUS, invoiceNumber, money } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { useNow } from '@/lib/use-now';
import type { InvoiceListItem, InvoiceStatus } from '@/types/crm';

type Tab = 'documents' | 'justificatifs';

// Proformas et factures (phase 3 du processus v1.3) et justificatifs de
// paiement envoyés par les membres. Accepter un justificatif rattaché à une
// proforma enregistre le paiement et active le membre.
function Invoices() {
  const router = useRouter();
  const pathname = usePathname();
  const initial = useSearchParams();
  const queryClient = useQueryClient();
  const tab: Tab = initial.get('tab') === 'justificatifs' ? 'justificatifs' : 'documents';
  const [status, setStatus] = useState<InvoiceStatus | ''>((initial.get('status') as InvoiceStatus | null) ?? '');
  const [search, setSearch] = useState('');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', params.toString()],
    queryFn: () => api.get<{ data: InvoiceListItem[] }>(`/api/admin/invoices?${params}`).then((r) => r.data),
    enabled: tab === 'documents',
  });
  const { data: proofs } = useQuery({
    queryKey: ['admin-payment-proofs', 'PENDING'],
    queryFn: () => api.get<{ data: AdminProof[] }>('/api/admin/payment-proofs?status=PENDING').then((r) => r.data),
    retry: false,
  });

  const now = useNow();
  const isOverdue = (i: InvoiceListItem) => i.status === 'SENT' && Boolean(i.dueDate) && new Date(i.dueDate!).getTime() < now;
  const all = invoices ?? [];
  const receivable = all.filter((i) => i.status === 'SENT').reduce((sum, i) => sum + Number(i.total), 0);
  const overdue = all.filter(isOverdue);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const paidMonth = all.filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getTime() >= monthStart).reduce((sum, i) => sum + Number(i.total), 0);
  const pendingProofs = proofs?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        hue="orange"
        title="Proformas et factures"
        description="La proforma part après la confirmation du devis ; le client règle en espèces ou par virement et dépose son justificatif. Enregistrer le paiement émet la facture définitive et active le membre."
      />

      <div role="tablist" className="flex flex-wrap gap-2">
        {(
          [
            ['documents', 'Proformas et factures', null],
            ['justificatifs', 'Justificatifs à vérifier', pendingProofs],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => router.replace(`${pathname}?tab=${key}`)}
            className={cn('inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold', tab === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}
          >
            {label}
            {count !== null && <span className={cn('rounded-pill px-2 text-xs tabular-nums', count ? 'bg-brand-orange text-white' : 'bg-ink-900/8')}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'justificatifs' ? (
        !proofs || proofs.length === 0 ? (
          <EmptyState title="Aucun justificatif à vérifier" description="Les membres déposent leur justificatif de virement depuis « Devis et factures » dans leur espace." />
        ) : (
          <ProofList
            proofs={proofs}
            showMember
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-payment-proofs'] });
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              queryClient.invalidateQueries({ queryKey: ['admin-home'] });
            }}
          />
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi hue="orange" label="Proformas à encaisser" value={money(receivable)} hint="Envoyées, non payées (liste affichée)" />
            <Kpi label="Échues" value={money(overdue.reduce((s, i) => s + Number(i.total), 0))} hint={`${overdue.length} proforma${overdue.length > 1 ? 's' : ''}`} tone={overdue.length ? 'alert' : undefined} />
            <Kpi hue="green" label="Encaissé ce mois" value={money(paidMonth)} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input aria-label="Rechercher" className="h-10 w-64" placeholder="N° PF ou FA, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
              {(['', 'DRAFT', 'SENT', 'PAID', 'REFUNDED', 'CANCELLED'] as const).map((s) => (
                <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn('rounded-pill px-3.5 py-1.5 text-sm font-medium', status === s ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
                  {s ? INVOICE_STATUS[s].label : 'Toutes'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-500">Chargement…</p>
          ) : all.length === 0 ? (
            <EmptyState title="Aucun document" description="Préparez une proforma depuis un devis confirmé (fiche du lead ou page du devis)." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">N°</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Total TTC</th>
                    <th className="px-4 py-3">À régler avant</th>
                    <th className="px-4 py-3">Payée le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {all.map((i) => (
                    <tr key={i.id} className="hover:bg-ink-900/3">
                      <td className="px-4 py-3">
                        <Link href={`/admin/factures/${i.id}`} className="font-semibold text-ink-900 hover:underline">
                          {invoiceNumber(i)}
                        </Link>
                        <span className="block text-xs text-ink-500">
                          {i.number && i.proformaNumber ? `${i.proformaNumber} · ` : ''}
                          {i.lead?.reference}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{i.customerCompany || i.customerName}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <InvoiceBadge status={i.status} />
                          {isOverdue(i) && <Pill tone="red">En retard</Pill>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{money(i.total)}</td>
                      <td className={cn('px-4 py-3', isOverdue(i) ? 'font-semibold text-brand-orange' : 'text-ink-600')}>{i.status === 'SENT' ? dateFr(i.dueDate) : '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{dateFr(i.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <Invoices />
    </Suspense>
  );
}
