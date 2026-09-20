'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Check, FileText, Receipt, Rocket, ShieldCheck, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { AppointmentFormModal } from '@/components/admin/AppointmentFormModal';
import { ApproveAccountButton, ProofList } from '@/components/admin/PaymentProofs';
import { Avatar, errorMessage, Field, InvoiceBadge, OrderBadge, Pill, QuoteBadge, StageBadge, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import {
  ACTIVITY_LABEL,
  APPOINTMENT_LABEL,
  dateFr,
  dateTimeFr,
  MANUAL_ACTIVITY_TYPES,
  money,
  SOURCE_LABEL,
  STAGE_BY_VALUE,
  STAGES,
  staffName,
  toInputDateTime,
} from '@/lib/crm';
import { HUE_ACCENT } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { ActivityType, AppointmentStatus, LeadDetail, LeadStage, QuoteTemplate } from '@/types/crm';

const FLOW: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_SENT', 'WON'];

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const [error, setError] = useState<string | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [apptOpen, setApptOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm-lead', id],
    queryFn: () => api.get<{ data: LeadDetail }>(`/api/admin/crm/leads/${id}`).then((r) => r.data),
  });
  const { data: templates } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: () => api.get<{ data: QuoteTemplate[] }>('/api/admin/quotes/templates').then((r) => r.data),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-lead', id] });
    queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
  };
  const onError = (e: unknown) => setError(errorMessage(e));

  const stage = useMutation({
    mutationFn: (input: { stage: LeadStage; lostReason?: string }) => api.post(`/api/admin/crm/leads/${id}/stage`, input),
    onSuccess: () => {
      setError(null);
      setLostOpen(false);
      setLostReason('');
      refresh();
    },
    onError,
  });
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/crm/leads/${id}`, body),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError,
  });
  const createQuote = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/admin/quotes', { leadId: id, templateId: templateId || undefined }).then((r) => r.data),
    onSuccess: (quote) => router.push(`/admin/devis/${quote.id}`),
    onError,
  });
  const createInvoice = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/admin/invoices', { leadId: id }).then((r) => r.data),
    onSuccess: (invoice) => router.push(`/admin/factures/${invoice.id}`),
    onError,
  });
  const appointmentStatus = useMutation({
    mutationFn: (input: { id: string; status: AppointmentStatus }) => api.patch(`/api/admin/crm/appointments/${input.id}`, { status: input.status }),
    onSuccess: refresh,
    onError,
  });

  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!lead) return <EmptyState title="Lead introuvable" />;

  const closed = lead.stage === 'WON' || lead.stage === 'LOST';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/pipeline" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-400">{lead.reference}</p>
            <h1 className="font-heading text-2xl font-bold text-ink-900">{lead.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {lead.contactName}
              {lead.companyName ? ` · ${lead.companyName}` : ''} · {SOURCE_LABEL[lead.source]} · créé le {dateFr(lead.createdAt)}
            </p>
          </div>
          <StageBadge stage={lead.stage} />
        </div>
      </div>

      {/* Étapes du pipeline */}
      <nav aria-label="Étape du lead" className="flex flex-wrap items-center gap-2">
        {FLOW.map((s, index) => {
          const meta = STAGES.find((x) => x.value === s)!;
          const current = lead.stage === s;
          const reached = FLOW.indexOf(lead.stage) >= index;
          return (
            <button
              key={s}
              type="button"
              disabled={stage.isPending || current}
              aria-current={current ? 'step' : undefined}
              onClick={() => stage.mutate({ stage: s })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
                current ? 'border-ink-900 bg-ink-900 text-white' : reached && lead.stage !== 'LOST' ? 'border-ink-900/20 bg-ink-900/8 text-ink-800 hover:bg-ink-900/12' : 'border-ink-900/10 bg-white text-ink-600 hover:bg-ink-900/5',
              )}
            >
              {reached && lead.stage !== 'LOST' && !current && <Check className="h-3.5 w-3.5" />} {meta.label}
            </button>
          );
        })}
        <Button variant={lead.stage === 'LOST' ? 'secondary' : 'outline'} size="sm" disabled={lead.stage === 'LOST' || stage.isPending} onClick={() => setLostOpen(true)}>
          <X className="h-4 w-4" /> {lead.stage === 'LOST' ? 'Perdu' : 'Marquer perdu'}
        </Button>
      </nav>
      {lead.stage === 'LOST' && lead.lostReason && <p className="text-sm text-ink-600">Motif de perte : {lead.lostReason}</p>}

      {error && (
        <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <InfoCard lead={lead} staffOptions={staff ?? []} saving={patch.isPending} onSave={(body) => patch.mutate(body)} />

          {lead.serviceRequest && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="font-heading text-base font-bold text-ink-900">Demande du client (site)</h2>
                <ul className="divide-y divide-ink-900/8 rounded-xl border border-ink-900/8 text-sm">
                  {lead.serviceRequest.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 px-4 py-2.5">
                      <span>{item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title}</span>
                      <span className="tabular-nums text-ink-600">{item.unitPrice ? money(item.unitPrice) : 'Sur devis'}</span>
                    </li>
                  ))}
                </ul>
                {lead.serviceRequest.notes && <p className="whitespace-pre-line rounded-xl bg-ink-900/4 px-4 py-3 text-sm text-ink-700">{lead.serviceRequest.notes}</p>}
              </CardContent>
            </Card>
          )}

          <Journal lead={lead} staff={staff ?? []} onDone={refresh} onError={onError} />
        </div>

        <div className="space-y-6">
          <Card accent="orange">
            <CardContent className="space-y-4">
              <h2 className="font-heading text-base font-bold text-ink-900">Chaîne commerciale</h2>
              <div className="space-y-2">
                {templates && templates.length > 0 && (
                  <Select aria-label="Modèle de devis" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">{lead.serviceRequest ? 'Devis pré-rempli avec la demande' : 'Devis vierge'}</option>
                    {templates.filter((t) => t.isActive).map((t) => (
                      <option key={t.id} value={t.id}>
                        Modèle : {t.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Button className="w-full" disabled={createQuote.isPending || lead.stage === 'LOST'} onClick={() => createQuote.mutate()}>
                  <FileText className="h-4 w-4" /> Créer un devis
                </Button>
                <Button variant="outline" className="w-full" disabled={createInvoice.isPending || lead.stage === 'LOST'} onClick={() => createInvoice.mutate()}>
                  <Receipt className="h-4 w-4" /> Facturer directement
                </Button>
              </div>

              <DocList title="Devis" empty="Aucun devis">
                {lead.quotes.map((q) => (
                  <DocRow key={q.id} href={`/admin/devis/${q.id}`} title={q.number} sub={money(q.total)} badge={<QuoteBadge status={q.status} />} />
                ))}
              </DocList>
              <DocList title="Factures" empty="Aucune facture">
                {lead.invoices.map((i) => (
                  <DocRow key={i.id} href={`/admin/factures/${i.id}`} title={i.number ?? 'Brouillon'} sub={money(i.total)} badge={<InvoiceBadge status={i.status} />} />
                ))}
              </DocList>
              <DocList title="Lancement des services" empty="Rien à lancer">
                {lead.serviceOrders.map((o) => (
                  <DocRow key={o.id} href="/admin/lancements" icon={<Rocket className="h-3.5 w-3.5" />} title={o.title} badge={<OrderBadge status={o.status} />} />
                ))}
              </DocList>
            </CardContent>
          </Card>

          {lead.user && (
            <Card accent={lead.user.profile?.isPublic ? 'green' : 'yellow'}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                    <ShieldCheck className="h-4 w-4 text-ink-500" /> Compte & justificatifs
                  </h2>
                  <Pill tone={lead.user.profile?.isPublic ? 'green' : 'amber'}>{lead.user.profile?.isPublic ? 'Compte validé' : 'En attente'}</Pill>
                </div>
                <p className="text-xs text-ink-500">
                  {lead.user.profile?.isPublic
                    ? 'L’espace membre du client est déverrouillé.'
                    : 'Tant que le compte n’est pas validé, le client ne voit que « Situation du compte » (devis, reçu de paiement).'}
                </p>
                {!lead.user.profile?.isPublic && <ApproveAccountButton userId={lead.user.id} onDone={refresh} />}
                {lead.paymentProofs.length === 0 ? (
                  <p className="text-sm text-ink-400">Aucun justificatif reçu.</p>
                ) : (
                  <ProofList proofs={lead.paymentProofs} accountValidated={Boolean(lead.user.profile?.isPublic)} onChanged={refresh} />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink-900">Rendez-vous</h2>
                <Button variant="outline" size="sm" disabled={closed} onClick={() => setApptOpen(true)}>
                  <CalendarPlus className="h-4 w-4" /> Programmer
                </Button>
              </div>
              {lead.appointments.length === 0 ? (
                <p className="text-sm text-ink-500">Aucun rendez-vous.</p>
              ) : (
                <ul className="space-y-2">
                  {lead.appointments.map((a) => (
                    <li key={a.id} className="rounded-xl border border-ink-900/8 px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-900">
                          {APPOINTMENT_LABEL[a.type]} — {dateTimeFr(a.startAt)}
                        </span>
                        <Pill tone={a.status === 'DONE' ? 'green' : a.status === 'CANCELLED' ? 'gray' : 'blue'}>{a.status === 'DONE' ? 'Effectué' : a.status === 'CANCELLED' ? 'Annulé' : 'Prévu'}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {staffName(a.assignee)}
                        {a.location ? ` · ${a.location}` : ''}
                      </p>
                      {a.status === 'SCHEDULED' && (
                        <div className="mt-2 flex gap-3 text-xs">
                          <button type="button" className="font-medium text-green-700 hover:underline" onClick={() => appointmentStatus.mutate({ id: a.id, status: 'DONE' })}>
                            Marquer effectué
                          </button>
                          <button type="button" className="text-ink-500 hover:text-brand-orange" onClick={() => appointmentStatus.mutate({ id: a.id, status: 'CANCELLED' })}>
                            Annuler
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="Clôturer le lead comme perdu"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLostOpen(false)}>
              Annuler
            </Button>
            <Button disabled={stage.isPending || !lostReason.trim()} onClick={() => stage.mutate({ stage: 'LOST', lostReason })}>
              Confirmer
            </Button>
          </>
        }
      >
        <Field label="Motif de perte" htmlFor="lost-reason">
          <Textarea id="lost-reason" rows={3} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Prix, concurrent, pas de suite, hors périmètre…" autoFocus />
        </Field>
      </Modal>

      <AppointmentFormModal key={String(apptOpen)} open={apptOpen} onClose={() => setApptOpen(false)} leadId={id} />
    </div>
  );
}

function DocList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-500">{title}</h3>
      {hasRows ? <ul className="space-y-1.5">{children}</ul> : <p className="text-sm text-ink-400">{empty}</p>}
    </div>
  );
}

function DocRow({ href, title, sub, badge, icon }: { href: string; title: string; sub?: string; badge: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm hover:bg-ink-900/3">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-medium text-ink-900">{title}</span>
          {sub && <span className="shrink-0 text-xs tabular-nums text-ink-500">{sub}</span>}
        </span>
        {badge}
      </Link>
    </li>
  );
}

function InfoCard({ lead, staffOptions, saving, onSave }: { lead: LeadDetail; staffOptions: { id: string; displayName: string | null; email: string }[]; saving: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const initial = {
    title: lead.title,
    contactName: lead.contactName,
    companyName: lead.companyName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    expectedAmount: lead.expectedAmount ? String(Number(lead.expectedAmount)) : '',
    assignedToId: lead.assignedToId ?? '',
    nextActionAt: toInputDateTime(lead.nextActionAt),
    notes: lead.notes ?? '',
  };
  const [form, setForm] = useState(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Card accent={HUE_ACCENT[STAGE_BY_VALUE[lead.stage].tone]}>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-ink-900">Informations</h2>
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() =>
              onSave({
                title: form.title,
                contactName: form.contactName,
                companyName: form.companyName,
                email: form.email,
                phone: form.phone,
                expectedAmount: form.expectedAmount === '' ? null : Number(form.expectedAmount),
                assignedToId: form.assignedToId || null,
                nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
                notes: form.notes,
              })
            }
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre" htmlFor="f-title" className="sm:col-span-2">
            <Input id="f-title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Contact" htmlFor="f-contact">
            <Input id="f-contact" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="Entreprise" htmlFor="f-company">
            <Input id="f-company" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="f-email">
            <Input id="f-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Téléphone" htmlFor="f-phone">
            <Input id="f-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Montant estimé (DA)" htmlFor="f-amount">
            <Input id="f-amount" type="number" min="0" value={form.expectedAmount} onChange={(e) => set({ expectedAmount: e.target.value })} />
          </Field>
          <Field label="Commercial" htmlFor="f-assignee">
            <Select id="f-assignee" value={form.assignedToId} onChange={(e) => set({ assignedToId: e.target.value })}>
              <option value="">Non assigné</option>
              {staffOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {staffName(u)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prochaine action" htmlFor="f-next" className="sm:col-span-2">
            <Input id="f-next" type="datetime-local" value={form.nextActionAt} onChange={(e) => set({ nextActionAt: e.target.value })} />
            <p className="mt-1 text-xs text-ink-500">Vous serez alerté automatiquement à cette échéance.</p>
          </Field>
          <Field label="Notes" htmlFor="f-notes" className="sm:col-span-2">
            <Textarea id="f-notes" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        {lead.user && <p className="text-xs text-ink-500">Compte membre rattaché : {lead.user.email} — ses abonnements s’activent au paiement de la facture.</p>}
      </CardContent>
    </Card>
  );
}

function Journal({ lead, staff, onDone, onError }: { lead: LeadDetail; staff: { id: string; displayName: string | null; email: string }[]; onDone: () => void; onError: (e: unknown) => void }) {
  const [type, setType] = useState<ActivityType>('NOTE');
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  const add = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${lead.id}/activities`, { type, content, mentionIds: mentions }),
    onSuccess: () => {
      setContent('');
      setMentions([]);
      onDone();
    },
    onError,
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-heading text-base font-bold text-ink-900">Journal et échanges</h2>
        <div className="space-y-3 rounded-xl border border-ink-900/8 bg-ink-900/2 p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Type d’activité">
            {MANUAL_ACTIVITY_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={cn('rounded-pill px-3 py-1 text-xs font-semibold', type === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
                {ACTIVITY_LABEL[t]}
              </button>
            ))}
          </div>
          <Textarea aria-label="Nouvelle entrée du journal" rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Compte rendu d’appel, décision, information utile à l’équipe…" />
          {staff.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-ink-500">Notifier un collègue (mention)</legend>
              <div className="flex flex-wrap gap-2">
                {staff.map((u) => {
                  const on = mentions.includes(u.id);
                  return (
                    <label key={u.id} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs ring-1', on ? 'bg-brand-orange/10 text-brand-orange ring-brand-orange/40' : 'bg-white text-ink-600 ring-ink-900/10')}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setMentions((m) => (on ? m.filter((x) => x !== u.id) : [...m, u.id]))} />
                      @{staffName(u)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end">
            <Button size="sm" disabled={add.isPending || !content.trim()} onClick={() => add.mutate()}>
              {add.isPending ? 'Ajout…' : 'Ajouter au journal'}
            </Button>
          </div>
        </div>

        <ol className="space-y-4">
          {lead.activities.map((a) => (
            <li key={a.id} className="flex gap-3">
              <Avatar user={a.author} className={a.type === 'SYSTEM' ? 'bg-ink-900/15 text-ink-500' : undefined} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">{a.author ? staffName(a.author) : 'Système'}</span>
                  {a.type !== 'SYSTEM' && ` · ${ACTIVITY_LABEL[a.type]}`} · {dateTimeFr(a.occurredAt)}
                </p>
                <p className={cn('mt-0.5 whitespace-pre-line text-sm', a.type === 'SYSTEM' ? 'text-ink-500' : 'text-ink-800')}>{a.content}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
