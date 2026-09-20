'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { InvoiceBadge, Kpi, PageTitle, Pill } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, INVOICE_STATUS, money } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { useNow } from '@/lib/use-now';
import type { InvoiceListItem, InvoiceStatus } from '@/types/crm';

export default function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [search, setSearch] = useState('');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', params.toString()],
    queryFn: () => api.get<{ data: InvoiceListItem[] }>(`/api/admin/invoices?${params}`).then((r) => r.data),
  });

  const now = useNow();
  const isOverdue = (i: InvoiceListItem) => i.status === 'SENT' && Boolean(i.dueDate) && new Date(i.dueDate!).getTime() < now;
  const all = invoices ?? [];
  const receivable = all.filter((i) => i.status === 'SENT').reduce((sum, i) => sum + Number(i.total), 0);
  const overdue = all.filter(isOverdue);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const paidMonth = all.filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getTime() >= monthStart).reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <PageTitle hue="orange" title="Factures" description="Créées depuis un devis accepté (ou directement depuis un lead). Le paiement d’une facture lance les services facturés." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi hue="orange" label="À encaisser" value={money(receivable)} hint="Factures émises non payées (liste affichée)" />
        <Kpi label="Échues" value={money(overdue.reduce((s, i) => s + Number(i.total), 0))} hint={`${overdue.length} facture${overdue.length > 1 ? 's' : ''}`} tone={overdue.length ? 'alert' : undefined} />
        <Kpi hue="green" label="Encaissé ce mois" value={money(paidMonth)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Rechercher une facture" className="h-10 w-64" placeholder="N° de facture, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {(['', 'DRAFT', 'SENT', 'PAID', 'CANCELLED'] as const).map((s) => (
            <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn('rounded-pill px-3.5 py-1.5 text-sm font-medium', status === s ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
              {s ? INVOICE_STATUS[s].label : 'Toutes'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : all.length === 0 ? (
        <EmptyState title="Aucune facture" description="Créez une facture depuis un devis accepté ou depuis la fiche d’un lead." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Facture</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Total TTC</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Payée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8">
              {all.map((i) => (
                <tr key={i.id} className="hover:bg-ink-900/3">
                  <td className="px-4 py-3">
                    <Link href={`/admin/factures/${i.id}`} className="font-semibold text-ink-900 hover:underline">
                      {i.number ?? 'Brouillon'}
                    </Link>
                    <span className="block text-xs text-ink-500">{i.lead?.reference}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{i.customerCompany || i.customerName}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <InvoiceBadge status={i.status} />
                      {isOverdue(i) && <Pill tone="red">En retard</Pill>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(i.total)}</td>
                  <td className={cn('px-4 py-3', isOverdue(i) ? 'font-semibold text-brand-orange' : 'text-ink-600')}>{dateFr(i.dueDate)}</td>
                  <td className="px-4 py-3 text-ink-500">{dateFr(i.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
