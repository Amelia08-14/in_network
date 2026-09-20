'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, errorMessage, Field, OrderBadge, PageTitle, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, dateTimeFr, money, ORDER_STATUS, staffName, toInputDate } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { HUE } from '@/lib/palette';
import type { OrderDetail, OrderListItem, OrderStatus } from '@/types/crm';

const COLUMNS: OrderStatus[] = ['TO_START', 'IN_PROGRESS', 'DONE'];

export default function ServiceOrdersPage() {
  const [assignee, setAssignee] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: staff } = useStaff('/api/admin/service-orders/staff');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['service-orders', assignee],
    queryFn: () => api.get<{ data: OrderListItem[] }>(`/api/admin/service-orders${assignee ? `?assignee=${assignee}` : ''}`).then((r) => r.data),
  });

  const visible = (orders ?? []).filter((o) => o.status !== 'CANCELLED');

  return (
    <div className="space-y-6">
      <PageTitle hue="green" title="Lancement des services" description="Chaque facture payée génère une commande de service avec sa checklist. Cochez les étapes au fil de la réalisation." />

      <div className="max-w-xs">
        <Select aria-label="Filtrer par responsable" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Toute l’équipe</option>
          <option value="me">Mes lancements</option>
          {staff?.map((u) => (
            <option key={u.id} value={u.id}>
              {staffName(u)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : visible.length === 0 ? (
        <EmptyState title="Aucun service à lancer" description="Dès qu’une facture est marquée payée, ses services apparaissent ici." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((status) => {
            const items = visible.filter((o) => o.status === status);
            return (
              <section key={status} aria-label={ORDER_STATUS[status].label} className={cn('rounded-2xl border p-3', HUE[ORDER_STATUS[status].tone].border, HUE[ORDER_STATUS[status].tone].wash)}>
                <span aria-hidden className={cn('mb-3 block h-1.5 rounded-full', HUE[ORDER_STATUS[status].tone].solid)} />
                <header className="mb-3 flex items-center gap-2 px-1">
                  <h2 className="font-heading text-sm font-bold text-ink-900">{ORDER_STATUS[status].label}</h2>
                  <span className="rounded-pill bg-white px-2 py-0.5 text-xs font-semibold text-ink-600">{items.length}</span>
                </header>
                <ul className="space-y-2.5">
                  {items.map((o) => {
                    const done = o.tasks.filter((t) => t.isDone).length;
                    const pct = o.tasks.length ? Math.round((done / o.tasks.length) * 100) : 0;
                    const late = o.dueAt && o.status !== 'DONE' && new Date(o.dueAt) < new Date();
                    return (
                      <li key={o.id}>
                        <button type="button" onClick={() => setOpenId(o.id)} className={cn('w-full rounded-xl border border-l-4 border-ink-900/8 bg-white p-3.5 text-left shadow-soft transition-shadow hover:shadow-soft-lg', HUE[ORDER_STATUS[status].tone].edge)}>
                          <p className="text-sm font-semibold leading-snug text-ink-900">{o.title}</p>
                          <p className="mt-1 text-xs text-ink-500">
                            {o.invoice.customerCompany || o.invoice.customerName} · {o.invoice.number}
                          </p>
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
      )}

      {openId && <OrderModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function OrderModal({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff('/api/admin/service-orders/staff');
  const [newTask, setNewTask] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Cases cochées immédiatement à l'écran, avant la réponse du serveur.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const { data: order } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => api.get<{ data: OrderDetail }>(`/api/admin/service-orders/${id}`).then((r) => r.data),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
  };
  const onError = (e: unknown) => setError(errorMessage(e));

  const toggle = useMutation({
    mutationFn: (input: { taskId: string; isDone: boolean }) => api.patch(`/api/admin/service-orders/${id}/tasks/${input.taskId}`, { isDone: input.isDone }),
    onMutate: ({ taskId, isDone }) => setOptimistic((o) => ({ ...o, [taskId]: isDone })),
    onSuccess: () => setError(null),
    onError,
    onSettled: async (_data, _error, { taskId }) => {
      await queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setOptimistic(({ [taskId]: _done, ...rest }) => rest);
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    },
  });
  const addTask = useMutation({
    mutationFn: () => api.post(`/api/admin/service-orders/${id}/tasks`, { title: newTask }),
    onSuccess: () => {
      setNewTask('');
      refresh();
    },
    onError,
  });
  const removeTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/api/admin/service-orders/${id}/tasks/${taskId}`),
    onSuccess: refresh,
    onError,
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/service-orders/${id}`, body),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError,
  });

  return (
    <Modal open onClose={onClose} title={order?.title ?? 'Commande de service'} size="lg">
      {!order ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-600">
              <p>
                {order.invoice.customerCompany || order.invoice.customerName} · facture{' '}
                <Link href={`/admin/factures/${order.invoice.id}`} className="font-medium text-brand-blue hover:underline">
                  {order.invoice.number}
                </Link>{' '}
                ({money(order.invoice.total)})
                {order.lead && (
                  <>
                    {' · '}
                    <Link href={`/admin/crm/leads/${order.lead.id}`} className="font-medium text-brand-blue hover:underline">
                      {order.lead.reference}
                    </Link>
                  </>
                )}
              </p>
              {order.startedAt && <p className="text-xs text-ink-400">Démarré le {dateTimeFr(order.startedAt)}</p>}
              {order.completedAt && <p className="text-xs text-ink-400">Livré le {dateTimeFr(order.completedAt)}</p>}
            </div>
            <OrderBadge status={order.status} />
          </div>

          {order.subscription && (
            <p className="rounded-xl bg-accent-green/15 px-4 py-2.5 text-sm text-green-800">
              Abonnement activé pour {order.user?.email} : du {dateFr(order.subscription.startDate)} au {dateFr(order.subscription.endDate)}.
            </p>
          )}
          {!order.user && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Aucun compte membre n’est rattaché à ce client : rattachez-le pour activer ses abonnements et le notifier.</p>}

          {error && (
            <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
              {error}
            </p>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Checklist</h3>
            <ul className="divide-y divide-ink-900/8 rounded-xl border border-ink-900/8">
              {order.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={optimistic[t.id] ?? t.isDone} onChange={(e) => toggle.mutate({ taskId: t.id, isDone: e.target.checked })} />
                    <span className={cn((optimistic[t.id] ?? t.isDone) && 'text-ink-400 line-through')}>{t.title}</span>
                  </label>
                  <button type="button" aria-label={`Supprimer l’étape « ${t.title} »`} onClick={() => removeTask.mutate(t.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-orange/10 hover:text-brand-orange">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTask.trim()) addTask.mutate();
              }}
            >
              <Input aria-label="Nouvelle étape" className="h-10" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Ajouter une étape…" />
              <Button type="submit" variant="outline" disabled={addTask.isPending || !newTask.trim()}>
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </form>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Responsable" htmlFor="o-assignee">
              <Select id="o-assignee" value={order.assignedTo?.id ?? ''} onChange={(e) => update.mutate({ assignedToId: e.target.value || null })}>
                <option value="">Non assigné</option>
                {staff?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {staffName(u)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Échéance" htmlFor="o-due">
              <Input id="o-due" type="date" value={toInputDate(order.dueAt)} onChange={(e) => update.mutate({ dueAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
            </Field>
            <Field label="Statut" htmlFor="o-status">
              <Select id="o-status" value={order.status} onChange={(e) => update.mutate({ status: e.target.value })}>
                {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <NotesField key={order.id} initial={order.notes ?? ''} onSave={(notes) => update.mutate({ notes })} />
        </div>
      )}
    </Modal>
  );
}

function NotesField({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial);
  return (
    <Field label="Notes internes" htmlFor="o-notes">
      <Textarea id="o-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== initial && onSave(notes)} placeholder="Suivi, échanges avec le client, points d’attention…" />
    </Field>
  );
}
