'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCheck, FileUp, PackageCheck, Play, Plus, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { errorMessage, Field, OrderBadge, PoleBadge, useStaff } from '@/components/admin/crm-ui';
import { adminApiPostForm, api } from '@/lib/admin-api';
import { dateFr, dateTimeFr, invoiceNumber, money, openAdminPdf, staffName, toInputDate } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { MemberDocumentKind, OfficeAvailability, OrderDetail } from '@/types/crm';

export const DOCUMENT_KINDS: { value: MemberDocumentKind; label: string }[] = [
  { value: 'CONTRACT', label: 'Contrat signé' },
  { value: 'DOMICILIATION_CERTIFICATE', label: 'Attestation de domiciliation' },
  { value: 'OFFICIAL_DOCUMENT', label: 'Document officiel (RC, NIF, statuts…)' },
  { value: 'RECEIPT', label: 'Reçu' },
  { value: 'OTHER', label: 'Autre document' },
];

/** Dépôt d'un document remis au membre (visible dans son historique). */
export function DocumentUpload({ userId, orderId, onDone }: { userId: string; orderId?: string; onDone: () => void }) {
  const [kind, setKind] = useState<MemberDocumentKind>('CONTRACT');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: () => adminApiPostForm(`/api/admin/member-services/${userId}/documents`, file!, { kind, title, orderId }),
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setError(null);
      onDone();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-ink-900/15 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select aria-label="Type de document" value={kind} onChange={(e) => setKind(e.target.value as MemberDocumentKind)}>
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Input aria-label="Intitulé (facultatif)" placeholder="Intitulé (facultatif)" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Fichier" className="min-w-0 flex-1 text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button size="sm" variant="outline" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          <FileUp className="h-4 w-4" /> {upload.isPending ? 'Envoi…' : 'Remettre au membre'}
        </Button>
      </div>
      {error && <p className="text-xs text-brand-orange">{error}</p>}
    </div>
  );
}

// Un service du panier côté équipe : sa checklist de livraison, son
// avancement (activation → livrable prêt → validation du membre ⇄ ajustement
// → livré / actif), sa période et les documents remis au membre.
export function ServiceOrderModal({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff('/api/admin/service-orders/staff');
  const [newTask, setNewTask] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'adjust' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const { data: order } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => api.get<{ data: OrderDetail }>(`/api/admin/service-orders/${id}`).then((r) => r.data),
  });
  // Bureaux privatifs (pôle Espaces) : l'Office Manager attribue le bureau loué au mois.
  const { data: offices } = useQuery({
    queryKey: ['offices'],
    queryFn: () => api.get<{ data: OfficeAvailability[] }>('/api/admin/service-orders/offices').then((r) => r.data),
    enabled: order?.pole === 'SPACES',
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    queryClient.invalidateQueries({ queryKey: ['member-file'] });
    queryClient.invalidateQueries({ queryKey: ['admin-home'] });
    queryClient.invalidateQueries({ queryKey: ['offices'] });
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
  const action = useMutation({
    mutationFn: (input: { path: 'start' | 'ready' | 'validate' | 'adjustment' | 'cancel'; body?: Record<string, unknown> }) => api.post(`/api/admin/service-orders/${id}/${input.path}`, input.body),
    onSuccess: () => {
      setError(null);
      setMode(null);
      setNote('');
      refresh();
    },
    onError,
  });

  const memberName = order?.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order?.user?.email;

  return (
    <Modal open onClose={onClose} title={order?.title ?? 'Service'} size="lg">
      {!order ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-sm text-ink-600">
              <p>
                {order.user ? (
                  <Link href={`/admin/membres/${order.user.id}`} className="font-medium text-brand-blue hover:underline">
                    {memberName}
                  </Link>
                ) : (
                  order.invoice.customerCompany || order.invoice.customerName
                )}{' '}
                · facture{' '}
                <Link href={`/admin/factures/${order.invoice.id}`} className="font-medium text-brand-blue hover:underline">
                  {invoiceNumber(order.invoice)}
                </Link>
                {order.amount ? ` · ${money(order.amount)} HT` : ''}
                {order.lead && (
                  <>
                    {' · '}
                    <Link href={`/admin/crm/leads/${order.lead.id}`} className="font-medium text-brand-blue hover:underline">
                      {order.lead.reference}
                    </Link>
                  </>
                )}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <PoleBadge pole={order.pole} />
                {order.subsidiary && <span className="text-xs">{order.subsidiary}</span>}
                {order.renewedFrom && <span className="text-xs">Renouvellement de « {order.renewedFrom.title} »</span>}
              </p>
              {order.readyAt && <p className="text-xs text-ink-400">Livrable prêt le {dateTimeFr(order.readyAt)}</p>}
              {order.completedAt && (
                <p className="text-xs text-ink-400">
                  Validé le {dateTimeFr(order.completedAt)}
                  {order.validatedBy ? ` par ${staffName(order.validatedBy)}` : ' par le membre'}
                </p>
              )}
            </div>
            <OrderBadge status={order.status} />
          </div>

          {order.status === 'ADJUSTMENT_REQUESTED' && order.adjustmentNote && (
            <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange">Ajustement demandé : {order.adjustmentNote}</p>
          )}
          {!order.user && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Aucun compte membre rattaché : complétez l’e-mail du client sur sa fiche lead pour ouvrir son espace.</p>}
          {error && (
            <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
              {error}
            </p>
          )}

          {/* Avancement de la livraison */}
          {order.status !== 'DONE' && order.status !== 'CANCELLED' && (
            <div className="flex flex-wrap gap-2">
              {(order.status === 'TO_START' || order.status === 'ADJUSTMENT_REQUESTED') && (
                <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ path: 'start' })}>
                  <Play className="h-4 w-4" /> {order.status === 'TO_START' ? 'Démarrer l’activation' : 'Reprendre la livraison'}
                </Button>
              )}
              {order.status !== 'AWAITING_VALIDATION' && (
                <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: 'ready' })}>
                  <PackageCheck className="h-4 w-4" /> Livrable prêt
                </Button>
              )}
              {order.status === 'AWAITING_VALIDATION' && (
                <>
                  <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: 'validate' })}>
                    <CheckCheck className="h-4 w-4" /> Validé avec le membre
                  </Button>
                  <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => setMode('adjust')}>
                    <Wrench className="h-4 w-4" /> Ajustement demandé
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => setMode('cancel')}>
                <Ban className="h-4 w-4" /> Annuler
              </Button>
            </div>
          )}
          {order.status === 'AWAITING_VALIDATION' && <p className="text-xs text-ink-500">Le membre peut aussi valider ou demander un ajustement depuis « Mes services ».</p>}
          {mode && (
            <div className="space-y-2 rounded-xl border border-ink-900/10 p-3">
              <Field label={mode === 'adjust' ? 'Ce qui doit être corrigé' : 'Motif de l’annulation'} htmlFor="o-note">
                <Textarea id="o-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              </Field>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                  Retour
                </Button>
                <Button
                  size="sm"
                  disabled={action.isPending || note.trim().length < 2}
                  onClick={() => action.mutate(mode === 'adjust' ? { path: 'adjustment', body: { note } } : { path: 'cancel', body: { reason: note } })}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Checklist de livraison</h3>
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Field label="À livrer pour le" htmlFor="o-due">
              <Input id="o-due" type="date" value={toInputDate(order.dueAt)} onChange={(e) => update.mutate({ dueAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
            </Field>
            <Field label="Début" htmlFor="o-start">
              <Input id="o-start" type="date" value={toInputDate(order.startsAt)} onChange={(e) => update.mutate({ startsAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })} />
            </Field>
            <Field label="Échéance" htmlFor="o-end">
              <Input id="o-end" type="date" value={toInputDate(order.expiresAt)} onChange={(e) => update.mutate({ expiresAt: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })} />
            </Field>
          </div>
          {order.pole === 'SPACES' && offices && offices.length > 0 && (
            <Field label="Bureau attribué (bureaux privatifs loués au mois)" htmlFor="o-office">
              <Select id="o-office" value={order.space?.id ?? ''} onChange={(e) => update.mutate({ spaceId: e.target.value || null })}>
                <option value="">Aucun bureau</option>
                {offices.map((office) => {
                  const takenByOther = office.occupiedBy && office.occupiedBy.orderId !== order.id;
                  return (
                    <option key={office.id} value={office.id} disabled={Boolean(takenByOther)}>
                      {office.name} · {office.capacity} pers.{takenByOther ? ` — occupé (${office.occupiedBy!.member ?? office.occupiedBy!.title})` : ''}
                    </option>
                  );
                })}
              </Select>
            </Field>
          )}
          {order.subscription && (
            <p className="text-xs text-ink-500">
              Abonnement du membre : du {dateFr(order.subscription.startDate)} au {dateFr(order.subscription.endDate)}.
            </p>
          )}

          {order.user && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Documents remis au membre</h3>
              {order.documents.length > 0 && (
                <ul className="space-y-1.5">
                  {order.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm">
                      <span className="truncate text-ink-800">{d.title}</span>
                      <button type="button" className="text-xs font-medium text-brand-blue hover:underline" onClick={() => openAdminPdf(`/api/admin/member-services/documents/${d.id}/file`).catch(onError)}>
                        Ouvrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <DocumentUpload userId={order.user.id} orderId={order.id} onDone={refresh} />
            </div>
          )}

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
