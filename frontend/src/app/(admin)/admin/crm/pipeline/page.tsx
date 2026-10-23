'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarClock, Columns3, Inbox, LayoutList, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadFormModal } from '@/components/admin/LeadFormModal';
import { AssigneeOptions, Avatar, CircuitBadge, KindBadge, PageTitle, Pill, PriorityBadge, StageBadge, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { CIRCUIT, dateFr, KIND, money, originLabel, PIPELINE, STAGES, staffName } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { HUE } from '@/lib/palette';
import { useNow } from '@/lib/use-now';
import type { LeadCircuit, LeadKind, LeadListItem, LeadPipeline, LeadQueue, LeadStage } from '@/types/crm';

type View = 'kanban' | 'list';

// Colonnes du suivi : du lead confié jusqu'au devis confirmé. L'entrée
// (aiguillage, attribution) se fait dans « À aiguiller » ; les étapes avancent
// par les gestes du processus sur la fiche (qualifier, relancer, confirmer la
// visite, envoyer le devis…), pas par glisser-déposer : c'est ce qui garde le
// flux cohérent et tracé.
const COLUMNS: LeadStage[] = ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED'];

const QUEUE_LABEL: Record<LeadQueue, string> = {
  to_dispatch: 'À aiguiller',
  to_assign: 'À attribuer',
  returned: 'Revenus sans réponse',
  handed_over: 'Dossiers transmis par la Sales Team',
  to_call: 'Devis confirmés : paiement à organiser',
  follow_ups_due: 'Actions du jour et en retard',
};

function Pipeline() {
  const access = useCrmAccess();
  const initial = useSearchParams();
  const [view, setView] = useState<View>('kanban');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState(initial.get('assignee') ?? '');
  const [circuit, setCircuit] = useState<'' | LeadCircuit>('');
  const [pipeline, setPipeline] = useState<'' | LeadPipeline>('');
  const [kind, setKind] = useState<'' | LeadKind>('');
  const [queue, setQueue] = useState<'' | LeadQueue>((initial.get('queue') as LeadQueue | null) ?? '');
  const [closed, setClosed] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: staff } = useStaff();

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (assignee) params.set('assignee', assignee);
  if (circuit) params.set('circuit', circuit);
  if (pipeline) params.set('pipeline', pipeline);
  if (kind) params.set('kind', kind);
  if (queue) params.set('queue', queue);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['crm-leads', params.toString()],
    queryFn: () => api.get<{ data: LeadListItem[] }>(`/api/admin/crm/leads?${params}`).then((r) => r.data),
  });

  const now = useNow();
  const { columns, waiting, closedLeads } = useMemo(() => {
    const map = new Map<LeadStage, LeadListItem[]>(COLUMNS.map((s) => [s, []]));
    const entry: LeadListItem[] = [];
    const done: LeadListItem[] = [];
    for (const lead of leads ?? []) {
      if (lead.stage === 'REGISTERED') entry.push(lead);
      else if (lead.stage === 'PAID' || lead.stage === 'LOST') done.push(lead);
      else map.get(lead.stage)?.push(lead);
    }
    return { columns: map, waiting: entry, closedLeads: done };
  }, [leads]);

  const overdue = (lead: LeadListItem) => Boolean(lead.nextActionAt) && new Date(lead.nextActionAt!).getTime() < now && !['PAID', 'LOST'].includes(lead.stage);
  const listLeads = (leads ?? []).filter((l) => closed || !['PAID', 'LOST'].includes(l.stage));

  return (
    <div className="space-y-6">
      <PageTitle
        hue="blue"
        title="Pipeline"
        description={
          access.direction
            ? 'Les deux circuits, du lead confié au devis confirmé. Ouvrez une fiche pour faire avancer le dossier.'
            : access.salesManager
              ? 'Les leads de la Sales Team (circuit 1), jusqu’à leur transmission à l’Office Manager.'
              : access.officeManager
                ? 'Vos leads du circuit 2 et les dossiers transmis par la Sales Team.'
                : 'Vos leads : qualifiez, relancez, obtenez la visite ou la visio, puis transmettez le dossier.'
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Enregistrer un lead
          </Button>
        }
      />

      {access.manageLeads && waiting.length > 0 && (
        <Link
          href="/admin/crm/entrants"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue/25 bg-brand-blue/[0.05] px-5 py-3.5 text-sm transition-colors hover:bg-brand-blue/[0.09]"
        >
          <span className="flex items-center gap-2.5 text-ink-800">
            <Inbox className="h-4 w-4 text-brand-blue" />
            <span>
              <strong>{waiting.length}</strong> lead{waiting.length > 1 ? 's' : ''} enregistré{waiting.length > 1 ? 's' : ''}, à aiguiller ou à attribuer
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-blue">
            Traiter <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Rechercher un lead" className="h-10 w-60" placeholder="Nom, société, téléphone, référence…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Intervenant" className="h-10 w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Tous les intervenants</option>
          <option value="me">Mes dossiers</option>
          <AssigneeOptions staff={staff} />
        </Select>
        {(access.direction || access.allLeads) && (
          <Select aria-label="Circuit" className="h-10 w-44" value={circuit} onChange={(e) => setCircuit(e.target.value as '' | LeadCircuit)}>
            <option value="">Tous les circuits</option>
            {(Object.keys(CIRCUIT) as LeadCircuit[]).map((c) => (
              <option key={c} value={c}>
                {CIRCUIT[c].label}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Pipeline d’entrée" className="h-10 w-52" value={pipeline} onChange={(e) => setPipeline(e.target.value as '' | LeadPipeline)}>
          <option value="">Tous les pipelines</option>
          {(Object.keys(PIPELINE) as LeadPipeline[]).map((p) => (
            <option key={p} value={p}>
              {PIPELINE[p].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Type d’affaire" className="h-10 w-44" value={kind} onChange={(e) => setKind(e.target.value as '' | LeadKind)}>
          <option value="">Toutes les affaires</option>
          {(Object.keys(KIND) as LeadKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND[k].label}
            </option>
          ))}
        </Select>
        <div className="ml-auto inline-flex rounded-xl border border-ink-900/10 bg-white p-1" role="group" aria-label="Affichage">
          {([['kanban', 'Colonnes', Columns3], ['list', 'Liste', LayoutList]] as const).map(([value, label, Icon]) => (
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

      {queue && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
          Filtre : <Pill tone="blue">{QUEUE_LABEL[queue]}</Pill>
          <button type="button" className="text-brand-blue hover:underline" onClick={() => setQueue('')}>
            Retirer
          </button>
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : !leads || leads.length === 0 ? (
        <EmptyState title="Aucun lead" description="Aucun dossier ne correspond à ces filtres." />
      ) : view === 'kanban' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-4">
            {COLUMNS.map((value) => {
              const stage = STAGES.find((s) => s.value === value)!;
              const items = columns.get(value) ?? [];
              const total = items.reduce((sum, l) => sum + Number(l.expectedAmount ?? 0), 0);
              return (
                <section key={value} aria-label={`Étape ${stage.label}`} className={cn('w-64 shrink-0 rounded-2xl border p-3', HUE[stage.tone].border, HUE[stage.tone].wash)}>
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
                      <li key={lead.id} className={cn('rounded-xl border border-l-4 border-ink-900/8 bg-white p-3 shadow-soft', HUE[stage.tone].edge)}>
                        <Link href={`/admin/crm/leads/${lead.id}`} className="block">
                          <p className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide text-ink-400">
                            {lead.reference}
                            <PriorityBadge priority={lead.priority} />
                          </p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug text-ink-900">{lead.title}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                            <Building2 className="h-3 w-3 shrink-0" /> <span className="truncate">{lead.companyName || lead.contactName}</span>
                          </p>
                          <span className="mt-2 flex flex-wrap gap-1">
                            <CircuitBadge circuit={lead.circuit} />
                            <KindBadge kind={lead.kind} />
                            {lead.handedOverAt && (
                              <Pill tone="gray">
                                <Send className="mr-1 h-3 w-3" /> Transmis
                              </Pill>
                            )}
                          </span>
                        </Link>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold tabular-nums text-ink-900">{lead.expectedAmount ? money(lead.expectedAmount) : <span className="font-normal text-ink-400">Montant à définir</span>}</span>
                          <span className="flex -space-x-1.5">
                            {lead.salesAgent && lead.salesAgent.id !== lead.assignedToId && <Avatar user={lead.salesAgent} className="ring-2 ring-white" />}
                            <Avatar user={lead.assignedTo} className="ring-2 ring-white" />
                          </span>
                        </div>
                        {lead.nextActionAt && (
                          <p className={cn('mt-2 flex items-center gap-1.5 text-xs', overdue(lead) ? 'font-semibold text-brand-orange' : 'text-ink-500')}>
                            <CalendarClock className="h-3 w-3" /> {overdue(lead) ? 'En retard : ' : 'Action : '}
                            {dateFr(lead.nextActionAt)}
                          </p>
                        )}
                      </li>
                    ))}
                    {items.length === 0 && <li className="rounded-xl border border-dashed border-ink-900/12 px-3 py-6 text-center text-xs text-ink-400">Aucun dossier</li>}
                  </ul>
                </section>
              );
            })}
          </div>
          {closedLeads.length > 0 && (
            <p className="mt-3 text-xs text-ink-500">
              {closedLeads.filter((l) => l.stage === 'PAID').length} gagné(s) et {closedLeads.filter((l) => l.stage === 'LOST').length} perdu(s) dans cette sélection : affichez la liste pour les voir.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="h-4 w-4" /> Inclure les dossiers clos (gagnés, perdus)
          </label>
          <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Étape</th>
                  <th className="px-4 py-3">Origine</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3">Prochaine action</th>
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
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StageBadge stage={lead.stage} circuit={lead.circuit} />
                        <KindBadge kind={lead.kind} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{originLabel(lead)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{lead.expectedAmount ? money(lead.expectedAmount) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar user={lead.assignedTo} /> <span className="text-ink-600">{staffName(lead.assignedTo)}</span>
                      </span>
                    </td>
                    <td className={cn('px-4 py-3', overdue(lead) ? 'font-semibold text-brand-orange' : 'text-ink-600')}>{dateFr(lead.nextActionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <Pipeline />
    </Suspense>
  );
}
