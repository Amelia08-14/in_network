'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarClock, LayoutList, Plus, Columns3, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadFormModal } from '@/components/admin/LeadFormModal';
import { AssigneeOptions, Avatar, errorMessage, Field, PageTitle, PriorityBadge, StageBadge, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, MANAGER_STAGES, money, PIPELINE_STAGES, SOURCE_LABEL, STAGE_BY_VALUE, STAGES, staffName } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { HUE } from '@/lib/palette';
import { useNow } from '@/lib/use-now';
import type { LeadListItem, LeadSource, LeadStage } from '@/types/crm';

type View = 'kanban' | 'list';

// Le pipeline, c'est le travail commercial : leads assignés → contactés → devis → signés.
// La qualification et l'assignation (étapes « À qualifier » / « À assigner ») se font dans
// « Leads à traiter », réservé au responsable commercial. Un commercial ne voit ici que
// ses propres leads (l'API le garantit).
export default function PipelinePage() {
  const queryClient = useQueryClient();
  const access = useCrmAccess();
  const [view, setView] = useState<View>('kanban');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [source, setSource] = useState('');
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);
  const [lostTarget, setLostTarget] = useState<LeadListItem | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const { data: staff } = useStaff();

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (assignee) params.set('assignee', assignee);
  if (source) params.set('source', source);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['crm-leads', params.toString()],
    queryFn: () => api.get<{ data: LeadListItem[] }>(`/api/admin/crm/leads?${params}`).then((r) => r.data),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; stage: LeadStage; lostReason?: string }) =>
      api.post(`/api/admin/crm/leads/${input.id}/stage`, { stage: input.stage, lostReason: input.lostReason }),
    onSuccess: () => {
      setMessage(null);
      setLostTarget(null);
      setLostReason('');
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    },
    onError: (e) => setMessage(errorMessage(e)),
  });

  function requestMove(lead: LeadListItem, stage: LeadStage) {
    if (lead.stage === stage) return;
    if (stage === 'LOST') {
      setLostTarget(lead);
      return;
    }
    move.mutate({ id: lead.id, stage });
  }

  // Étapes proposées dans le sélecteur d'une carte : un commercial ne ramène pas un lead
  // en qualification / assignation (réservé au responsable).
  const stageOptions = access.manageLeads ? PIPELINE_STAGES : PIPELINE_STAGES.filter((s) => !MANAGER_STAGES.includes(s.value));

  const { pipeline, toQualify, toAssign } = useMemo(() => {
    const map = new Map<LeadStage, LeadListItem[]>(PIPELINE_STAGES.map((s) => [s.value, []]));
    const inbox: LeadListItem[] = [];
    const assign: LeadListItem[] = [];
    for (const lead of leads ?? []) {
      if (lead.stage === 'NEW') inbox.push(lead);
      else if (lead.stage === 'QUALIFIED') assign.push(lead);
      else map.get(lead.stage)?.push(lead);
    }
    return { pipeline: map, toQualify: inbox, toAssign: assign };
  }, [leads]);

  const now = useNow();
  const overdue = (lead: LeadListItem) => Boolean(lead.nextActionAt) && new Date(lead.nextActionAt!).getTime() < now && lead.stage !== 'WON' && lead.stage !== 'LOST';
  const pending = toQualify.length + toAssign.length;
  const listLeads = view === 'list' ? leads ?? [] : [];
  const pipelineCount = (leads?.length ?? 0) - pending;

  return (
    <div className="space-y-6">
      <PageTitle
        hue="blue"
        title="Pipeline"
        description={
          access.allLeads
            ? 'Le travail commercial de l’équipe : glissez les opportunités d’une étape à l’autre, ou changez l’étape depuis la carte.'
            : 'Vos leads assignés : glissez-les d’une étape à l’autre, ou changez l’étape depuis la carte.'
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau lead
          </Button>
        }
      />

      {access.manageLeads && pending > 0 && (
        <Link
          href="/admin/crm/entrants"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue/25 bg-brand-blue/[0.05] px-5 py-3.5 text-sm transition-colors hover:bg-brand-blue/[0.09]"
        >
          <span className="flex items-center gap-2.5 text-ink-800">
            <Inbox className="h-4 w-4 text-brand-blue" />
            <span>
              <strong>{toQualify.length}</strong> lead{toQualify.length > 1 ? 's' : ''} à qualifier · <strong>{toAssign.length}</strong> à assigner
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-blue">
            Traiter les leads <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
      {!access.manageLeads && toQualify.length > 0 && (
        <p className="rounded-xl bg-brand-blue/[0.06] px-4 py-2.5 text-sm text-ink-700">
          {toQualify.length} lead{toQualify.length > 1 ? 's' : ''} que vous avez créé{toQualify.length > 1 ? 's' : ''} attend{toQualify.length > 1 ? 'ent' : ''} la validation du responsable commercial ({toQualify.map((l) => l.reference).join(', ')}).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Rechercher un lead" className="h-10 w-64" placeholder="Rechercher (nom, société, référence)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {access.allLeads && (
          <Select aria-label="Filtrer par commercial" className="h-10 w-52" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Tous les commerciaux</option>
            <option value="me">Mes leads</option>
            <option value="none">Non assignés</option>
            <AssigneeOptions staff={staff} />
          </Select>
        )}
        <Select aria-label="Filtrer par source" className="h-10 w-56" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Toutes les sources</option>
          {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </Select>
        <div className="ml-auto inline-flex rounded-xl border border-ink-900/10 bg-white p-1" role="group" aria-label="Affichage">
          {([['kanban', 'Kanban', Columns3], ['list', 'Liste', LayoutList]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', view === value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5')}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
          {message}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : !leads || leads.length === 0 ? (
        <EmptyState
          title="Aucun lead"
          description={
            access.allLeads
              ? 'Les demandes de devis du site, les inscriptions et les messages de contact arrivent ici automatiquement (à qualifier) ; vous pouvez aussi créer un lead à la main.'
              : 'Aucun lead ne vous est assigné pour le moment : le responsable commercial vous les confie après qualification.'
          }
        />
      ) : view === 'kanban' ? (
        pipelineCount === 0 ? (
          <EmptyState title="Aucun lead dans le pipeline" description="Les leads apparaissent ici une fois qualifiés et assignés à un commercial." />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
            <div className="flex min-w-max gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const items = pipeline.get(stage.value) ?? [];
                const total = items.reduce((sum, l) => sum + Number(l.expectedAmount ?? 0), 0);
                return (
                  <section
                    key={stage.value}
                    aria-label={`Étape ${stage.label}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverStage(stage.value);
                    }}
                    onDragLeave={() => setOverStage((s) => (s === stage.value ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOverStage(null);
                      const lead = leads.find((l) => l.id === (dragId ?? e.dataTransfer.getData('text/plain')));
                      if (lead) requestMove(lead, stage.value);
                      setDragId(null);
                    }}
                    className={cn('w-64 shrink-0 rounded-2xl border p-3 transition-colors', overStage === stage.value ? 'border-brand-orange bg-brand-orange/5' : cn(HUE[stage.tone].border, HUE[stage.tone].wash))}
                  >
                    <span aria-hidden className={cn('mb-3 block h-1.5 rounded-full', HUE[stage.tone].solid)} />
                    <header className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading text-sm font-bold text-ink-900">{stage.label}</h2>
                        <span className="rounded-pill bg-white px-2 py-0.5 text-xs font-semibold text-ink-600">{items.length}</span>
                      </div>
                      {total > 0 && <span className="text-xs tabular-nums text-ink-500">{money(total)}</span>}
                    </header>
                    <ul className="space-y-2.5">
                      {items.map((lead) => (
                        <li
                          key={lead.id}
                          draggable
                          onDragStart={(e) => {
                            setDragId(lead.id);
                            e.dataTransfer.setData('text/plain', lead.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStage(null);
                          }}
                          className={cn('cursor-grab rounded-xl border border-l-4 border-ink-900/8 bg-white p-3 shadow-soft active:cursor-grabbing', HUE[stage.tone].edge, dragId === lead.id && 'opacity-40')}
                        >
                          <Link href={`/admin/crm/leads/${lead.id}`} className="block">
                            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide text-ink-400">
                              {lead.reference}
                              <PriorityBadge priority={lead.priority} />
                            </p>
                            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink-900">{lead.title}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                              <Building2 className="h-3 w-3 shrink-0" /> <span className="truncate">{lead.companyName || lead.contactName}</span>
                            </p>
                          </Link>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold tabular-nums text-ink-900">{lead.expectedAmount ? money(lead.expectedAmount) : <span className="font-normal text-ink-400">Montant à définir</span>}</span>
                            <Avatar user={lead.assignedTo} />
                          </div>
                          {lead.nextActionAt && (
                            <p className={cn('mt-2 flex items-center gap-1.5 text-xs', overdue(lead) ? 'font-semibold text-brand-orange' : 'text-ink-500')}>
                              <CalendarClock className="h-3 w-3" /> {overdue(lead) ? 'En retard : ' : 'Action : '}
                              {dateFr(lead.nextActionAt)}
                            </p>
                          )}
                          <label className="sr-only" htmlFor={`stage-${lead.id}`}>
                            Changer l’étape de {lead.reference}
                          </label>
                          <select
                            id={`stage-${lead.id}`}
                            value={lead.stage}
                            onChange={(e) => requestMove(lead, e.target.value as LeadStage)}
                            className="mt-2.5 h-8 w-full rounded-lg border border-ink-900/10 bg-white px-2 text-xs text-ink-600"
                          >
                            {/* L'étape courante figure toujours dans la liste, même si elle n'est pas « choisissable ». */}
                            {(stageOptions.some((s) => s.value === lead.stage) ? stageOptions : [STAGE_BY_VALUE[lead.stage], ...stageOptions]).map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                      {items.length === 0 && <li className="rounded-xl border border-dashed border-ink-900/12 px-3 py-6 text-center text-xs text-ink-400">Déposez une carte ici</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Étape</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Commercial</th>
                <th className="px-4 py-3">Prochaine action</th>
                <th className="px-4 py-3">Mis à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8">
              {listLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-ink-900/3">
                  <td className="px-4 py-3">
                    <Link href={`/admin/crm/leads/${lead.id}`} className="font-medium text-ink-900 hover:underline">
                      {lead.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {lead.reference} · {lead.companyName || lead.contactName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <StageBadge stage={lead.stage} />
                      <PriorityBadge priority={lead.priority} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{SOURCE_LABEL[lead.source]}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{lead.expectedAmount ? money(lead.expectedAmount) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar user={lead.assignedTo} /> <span className="text-ink-600">{staffName(lead.assignedTo)}</span>
                    </span>
                  </td>
                  <td className={cn('px-4 py-3', overdue(lead) ? 'font-semibold text-brand-orange' : 'text-ink-600')}>{dateFr(lead.nextActionAt)}</td>
                  <td className="px-4 py-3 text-ink-500">{dateFr(lead.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-ink-900/8 px-4 py-2.5 text-xs text-ink-500">
            Étapes : {STAGES.map((s) => s.label).join(' → ')}.
          </p>
        </div>
      )}

      <Modal
        open={Boolean(lostTarget)}
        onClose={() => setLostTarget(null)}
        title="Clôturer le lead comme perdu"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLostTarget(null)}>
              Annuler
            </Button>
            <Button disabled={move.isPending || !lostReason.trim()} onClick={() => lostTarget && move.mutate({ id: lostTarget.id, stage: 'LOST', lostReason })}>
              Confirmer
            </Button>
          </>
        }
      >
        <Field label={`Motif de perte — ${lostTarget?.reference ?? ''}`} htmlFor="lost-reason">
          <Textarea id="lost-reason" rows={3} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Prix, concurrent, pas de suite, hors périmètre…" autoFocus />
        </Field>
      </Modal>

      <LeadFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
