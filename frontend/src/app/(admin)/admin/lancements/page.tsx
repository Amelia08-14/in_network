'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ServiceOrderModal } from '@/components/admin/ServiceOrderModal';
import { Avatar, PageTitle, Pill, PoleBadge, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, ORDER_STATUS, POLE, staffName } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { HUE } from '@/lib/palette';
import { useNow } from '@/lib/use-now';
import type { DeliveryPole, OrderListItem, OrderStatus } from '@/types/crm';

// Services clients (phases 4 à 7 du processus v1.3) : chaque ligne payée
// devient un service du panier du membre, livré par son pôle (Espaces et
// domiciliation, Création d'entreprise, Solutions IN Group), validé par le
// membre, puis suivi jusqu'à son échéance.

type View = 'livraison' | 'echeances' | 'livres';

const DELIVERY_COLUMNS: OrderStatus[] = ['TO_START', 'IN_PROGRESS', 'ADJUSTMENT_REQUESTED', 'AWAITING_VALIDATION'];
const DAY = 24 * 3600 * 1000;

const memberName = (o: OrderListItem) => (o.user?.profile ? `${o.user.profile.firstName} ${o.user.profile.lastName}` : o.invoice.customerCompany || o.invoice.customerName);

function ServiceOrders() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const access = useCrmAccess();
  const isSupport = access.role === 'ADMIN_SUPPORT';
  const view = (params.get('vue') as View | null) ?? 'livraison';
  const openId = params.get('order');
  const [pole, setPole] = useState<'' | DeliveryPole>((params.get('pole') as DeliveryPole | null) ?? (isSupport ? 'COMPANY_CREATION' : ''));
  const [assignee, setAssignee] = useState('');
  const { data: staff } = useStaff('/api/admin/service-orders/staff');
  const now = useNow();

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next}`);
  };

  const query = new URLSearchParams();
  if (pole) query.set('pole', pole);
  if (assignee) query.set('assignee', assignee);
  if (view === 'echeances') query.set('expiring', '1');
  if (view === 'livres') query.set('status', 'DONE');
  const statusFilter = params.get('status') as OrderStatus | null;

  const { data: orders, isLoading } = useQuery({
    queryKey: ['service-orders', query.toString()],
    queryFn: () => api.get<{ data: OrderListItem[] }>(`/api/admin/service-orders?${query}`).then((r) => r.data),
  });

  const all = (orders ?? []).filter((o) => o.status !== 'CANCELLED' && (!statusFilter || o.status === statusFilter));

  return (
    <div className="space-y-6">
      <PageTitle
        hue="green"
        title="Services clients"
        description="Chaque service payé entre dans le panier du membre. Le pôle concerné le livre, prévient quand le livrable est prêt, le membre valide ; puis l’échéance est suivie jusqu’au renouvellement."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap gap-2">
          {(
            [
              ['livraison', 'À livrer'],
              ['echeances', 'Échéances à 60 jours'],
              ['livres', 'Livrés / actifs'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={view === key}
              onClick={() => go({ vue: key, status: null })}
              className={cn('rounded-pill px-4 py-2 text-sm font-semibold', view === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {!isSupport && (
            <Select aria-label="Pôle" className="h-10 w-56" value={pole} onChange={(e) => setPole(e.target.value as '' | DeliveryPole)}>
              <option value="">Tous les pôles</option>
              {(Object.keys(POLE) as DeliveryPole[]).map((p) => (
                <option key={p} value={p}>
                  {POLE[p].label}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Responsable" className="h-10 w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Toute l’équipe</option>
            <option value="me">Mes services</option>
            {staff?.map((u) => (
              <option key={u.id} value={u.id}>
                {staffName(u)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {statusFilter && (
        <p className="flex items-center gap-2 text-sm text-ink-700">
          Filtre : <Pill tone={ORDER_STATUS[statusFilter].tone}>{ORDER_STATUS[statusFilter].label}</Pill>
          <button type="button" className="text-brand-blue hover:underline" onClick={() => go({ status: null })}>
            Retirer
          </button>
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : view === 'livraison' ? (
        all.filter((o) => DELIVERY_COLUMNS.includes(o.status)).length === 0 ? (
          <EmptyState title="Rien à livrer" description="Dès qu’un paiement est enregistré, les services payés apparaissent ici, répartis par pôle." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {DELIVERY_COLUMNS.map((status) => {
              const items = all.filter((o) => o.status === status);
              const meta = ORDER_STATUS[status];
              return (
                <section key={status} aria-label={meta.label} className={cn('rounded-2xl border p-3', HUE[meta.tone].border, HUE[meta.tone].wash)}>
                  <span aria-hidden className={cn('mb-3 block h-1.5 rounded-full', HUE[meta.tone].solid)} />
                  <header className="mb-3 flex items-center gap-2 px-1">
                    <h2 className="font-heading text-sm font-bold text-ink-900">{meta.label}</h2>
                    <span className="rounded-pill bg-white px-2 py-0.5 text-xs font-semibold text-ink-600">{items.length}</span>
                  </header>
                  <ul className="space-y-2.5">
                    {items.map((o) => {
                      const done = o.tasks.filter((t) => t.isDone).length;
                      const pct = o.tasks.length ? Math.round((done / o.tasks.length) * 100) : 0;
                      const late = o.dueAt && new Date(o.dueAt).getTime() < now;
                      return (
                        <li key={o.id}>
                          <button type="button" onClick={() => go({ order: o.id })} className={cn('w-full rounded-xl border border-l-4 border-ink-900/8 bg-white p-3.5 text-left shadow-soft transition-shadow hover:shadow-soft-lg', HUE[POLE[o.pole].tone].edge)}>
                            <p className="text-sm font-semibold leading-snug text-ink-900">{o.title}</p>
                            <p className="mt-1 text-xs text-ink-500">{memberName(o)}</p>
                            <span className="mt-2 block">
                              <PoleBadge pole={o.pole} />
                            </span>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-900/8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
                              <div className="h-full rounded-full bg-brand-orange" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                              <span>
                                {done}/{o.tasks.length} étapes
                              </span>
                              <span className="flex items-center gap-2">
                                {o.dueAt && (
                                  <span className={cn('flex items-center gap-1', late && 'font-semibold text-brand-orange')}>
                                    <CalendarClock className="h-3 w-3" /> {dateFr(o.dueAt)}
                                  </span>
                                )}
                                <Avatar user={o.assignedTo} className="h-6 w-6 text-[10px]" />
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    {items.length === 0 && <li className="rounded-xl border border-dashed border-ink-900/12 px-3 py-6 text-center text-xs text-ink-400">Rien ici</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : all.length === 0 ? (
        <EmptyState title={view === 'echeances' ? 'Aucune échéance proche' : 'Aucun service livré'} description={view === 'echeances' ? 'Les services qui arrivent à échéance dans les 60 jours (ou expirés sans renouvellement) apparaissent ici.' : 'Les services validés par les membres apparaissent ici.'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Membre</th>
                <th className="px-4 py-3">Pôle</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8">
              {all.map((o) => {
                const days = o.expiresAt ? Math.ceil((new Date(o.expiresAt).getTime() - now) / DAY) : null;
                return (
                  <tr key={o.id} className="cursor-pointer hover:bg-ink-900/3" onClick={() => go({ order: o.id })}>
                    <td className="px-4 py-3 font-medium text-ink-900">{o.title}</td>
                    <td className="px-4 py-3">
                      {o.user ? (
                        <Link href={`/admin/membres/${o.user.id}`} onClick={(e) => e.stopPropagation()} className="text-brand-blue hover:underline">
                          {memberName(o)}
                        </Link>
                      ) : (
                        memberName(o)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PoleBadge pole={o.pole} />
                    </td>
                    <td className="px-4 py-3 text-ink-600">{dateFr(o.startsAt)}</td>
                    <td className="px-4 py-3">
                      {o.expiresAt ? (
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums text-ink-700">{dateFr(o.expiresAt)}</span>
                          {o.renewedBy ? <Pill tone="gray">Renouvelé</Pill> : days !== null && days < 0 ? <Pill tone="red">Expiré</Pill> : days !== null && days <= 60 ? <Pill tone={days <= 7 ? 'red' : 'amber'}>J-{days}</Pill> : null}
                        </span>
                      ) : (
                        <span className="text-ink-400">Sans échéance</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{staffName(o.assignedTo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && <ServiceOrderModal id={openId} onClose={() => go({ order: null })} />}
    </div>
  );
}

export default function ServiceOrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <ServiceOrders />
    </Suspense>
  );
}
