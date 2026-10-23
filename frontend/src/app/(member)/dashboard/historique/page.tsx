'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, CreditCard, FileText, Loader2, PackageCheck, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { api, openMemberFile } from '@/lib/api';
import { dateFr, invoiceNumber, money, PAYMENT_LABEL } from '@/lib/crm';
import { HUE, type Hue } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { InvoiceStatus, PaymentMethod } from '@/types/crm';

// Historique de consommation (processus v1.3, espace client, fonction 3) :
// services souscrits, heures de salle utilisées face au forfait, événements
// suivis, paiements et documents remis (contrats, attestations…).

interface History {
  consumption: {
    plan: { name: string; startDate: string; endDate: string; includedMeetingHours: number } | null;
    meetingHoursUsed: number;
    bookingsCount: number;
    eventsAttended: number;
    eventsRegistered: number;
  };
  invoices: { id: string; number: string | null; proformaNumber: string | null; status: InvoiceStatus; total: string; paidAt: string | null; paymentMethod: PaymentMethod | null }[];
  documents: { id: string; title: string; kindLabel: string; createdAt: string; order: { title: string } | null }[];
  timeline: { date: string; kind: 'service' | 'payment' | 'quote' | 'event' | 'booking' | 'document'; label: string; detail?: string }[];
}

const KIND: Record<History['timeline'][number]['kind'], { icon: LucideIcon; hue: Hue }> = {
  service: { icon: PackageCheck, hue: 'green' },
  payment: { icon: CreditCard, hue: 'orange' },
  quote: { icon: Receipt, hue: 'blue' },
  event: { icon: CalendarDays, hue: 'violet' },
  booking: { icon: CalendarCheck, hue: 'amber' },
  document: { icon: FileText, hue: 'ink' },
};

export default function HistoryPage() {
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-history'],
    queryFn: () => api.get<{ data: History }>('/api/member/history').then((r) => r.data),
  });

  async function open(path: string) {
    setError(null);
    try {
      await openMemberFile(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ouvrir le document.');
    }
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }
  if (isError || !data) return <p className="text-sm text-red-600">Votre historique n’a pas pu être chargé. Réessayez dans un instant.</p>;

  const c = data.consumption;
  const hoursPct = c.plan && c.plan.includedMeetingHours > 0 ? Math.min(100, Math.round((c.meetingHoursUsed / c.plan.includedMeetingHours) * 100)) : null;
  const paid = data.invoices.filter((i) => i.status === 'PAID' || i.status === 'REFUNDED');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Historique</h1>
        <p className="mt-1 text-sm text-ink-500">Votre consommation, vos paiements et les documents que l’équipe vous a remis.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Salles de réunion</p>
          <p className="mt-1.5 font-heading text-2xl font-bold tabular-nums text-ink-900">
            {c.meetingHoursUsed} h{c.plan ? <span className="text-base font-normal text-ink-500"> / {c.plan.includedMeetingHours} h incluses</span> : null}
          </p>
          {hoursPct !== null && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-900/8" role="progressbar" aria-valuenow={hoursPct} aria-valuemin={0} aria-valuemax={100} aria-label="Heures utilisées sur le forfait">
              <div className={cn('h-full rounded-full', hoursPct >= 90 ? 'bg-brand-orange' : 'bg-accent-green')} style={{ width: `${hoursPct}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs text-ink-500">{c.plan ? `Forfait ${c.plan.name}, du ${dateFr(c.plan.startDate)} au ${dateFr(c.plan.endDate)}` : 'Aucun forfait en cours.'}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Réservations</p>
          <p className="mt-1.5 font-heading text-2xl font-bold tabular-nums text-ink-900">{c.bookingsCount}</p>
          <p className="mt-2 text-xs text-ink-500">Réservations confirmées ou effectuées.</p>
        </div>
        <div className="rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Événements</p>
          <p className="mt-1.5 font-heading text-2xl font-bold tabular-nums text-ink-900">{c.eventsAttended}</p>
          <p className="mt-2 text-xs text-ink-500">Événements suivis, sur {c.eventsRegistered} inscription{c.eventsRegistered > 1 ? 's' : ''}.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-ink-900">Chronologie</h2>
          {data.timeline.length === 0 ? (
            <EmptyState title="Rien pour l’instant" description="Vos services, paiements, réservations et événements apparaîtront ici." className="py-10" />
          ) : (
            <ol className="space-y-3">
              {data.timeline.map((e, i) => {
                const kind = KIND[e.kind];
                return (
                  <li key={`${e.date}-${i}`} className="flex items-start gap-3">
                    <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', HUE[kind.hue].soft, HUE[kind.hue].text)}>
                      <kind.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-800">{e.label}</span>
                      <span className="block text-xs text-ink-500">
                        {dateFr(e.date)}
                        {e.detail ? ` · ${e.detail}` : ''}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-bold text-ink-900">Documents remis</h2>
            {data.documents.length === 0 ? (
              <p className="text-sm text-ink-500">Vos contrats, attestations et documents officiels apparaîtront ici.</p>
            ) : (
              <ul className="space-y-2">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => open(`/api/member/documents/${d.id}/file`)} className="flex w-full items-center gap-3 rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-left text-sm hover:bg-ink-900/[0.03]">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-800">{d.title}</span>
                        <span className="block text-xs text-ink-500">
                          {d.kindLabel} · {dateFr(d.createdAt)}
                          {d.order ? ` · ${d.order.title}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-bold text-ink-900">Paiements</h2>
            {paid.length === 0 ? (
              <p className="text-sm text-ink-500">Aucun paiement enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {paid.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => open(`/api/member/invoices/${i.id}/pdf`)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-left text-sm hover:bg-ink-900/[0.03]">
                      <span>
                        <span className="block font-medium text-ink-800">Facture {invoiceNumber(i)}</span>
                        <span className="block text-xs text-ink-500">
                          {dateFr(i.paidAt)}
                          {i.paymentMethod ? ` · ${PAYMENT_LABEL[i.paymentMethod].toLowerCase()}` : ''}
                          {i.status === 'REFUNDED' ? ' · remboursée' : ''}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-ink-900">{money(i.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
