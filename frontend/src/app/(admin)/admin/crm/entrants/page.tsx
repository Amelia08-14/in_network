'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Inbox, Lock, Mail, Plus, RotateCcw, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AssignControl } from '@/components/admin/AssignControl';
import { DispatchControl, LoseModal } from '@/components/admin/LeadFlowControls';
import { LeadFormModal } from '@/components/admin/LeadFormModal';
import { KindBadge, PageTitle, Pill, PriorityBadge, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { CIRCUIT, dateFr, money, originLabel, PIPELINE, staffName, suggestCircuit } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { LeadListItem } from '@/types/crm';

// Entrée des prospects (phase 1 du processus v1.3). Tous les leads arrivent
// « Lead enregistré » ; la question d'aiguillage décide du circuit :
//   circuit 1 — la Sales Team (le responsable commercial attribue à un
//   sédentaire ou un terrain) ; circuit 2 — l'Office Manager en direct.
// Le responsable commercial retrouve ici aussi les leads revenus sans réponse.

type Tab = 'aiguiller' | 'attribuer' | 'relances';

const WORKING = ['ASSIGNED', 'QUALIFIED', 'FOLLOW_UP'];

function LeadCard({ lead, children, accent }: { lead: LeadListItem; children: React.ReactNode; accent: 'blue' | 'orange' | 'yellow' }) {
  return (
    <Card accent={accent}>
      <CardContent className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-ink-400">
              {lead.reference} · reçu le {dateFr(lead.createdAt)}
            </p>
            <Link href={`/admin/crm/leads/${lead.id}`} className="mt-0.5 block font-semibold leading-snug text-ink-900 hover:underline">
              {lead.title}
            </Link>
            <p className="mt-1 truncate text-sm text-ink-600">
              {lead.contactName}
              {lead.companyName ? ` · ${lead.companyName}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {lead.expectedAmount && <span className="text-sm font-bold tabular-nums text-ink-900">{money(lead.expectedAmount)}</span>}
            <PriorityBadge priority={lead.priority} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {lead.pipeline && <Pill tone={PIPELINE[lead.pipeline].tone}>{PIPELINE[lead.pipeline].label}</Pill>}
          <Pill tone="gray">{originLabel({ ...lead, pipeline: null })}</Pill>
          <KindBadge kind={lead.kind} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function IncomingLeads() {
  const access = useCrmAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canAttribute = access.salesManager || access.direction;
  const tab = (params.get('tab') as Tab | null) ?? 'aiguiller';
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['crm-leads', 'incoming'],
    queryFn: () => api.get<{ data: LeadListItem[] }>('/api/admin/crm/leads').then((r) => r.data),
    enabled: access.manageLeads,
  });

  const { toDispatch, toAssign, returned, workload } = useMemo(() => {
    const load = new Map<string, number>();
    const oldestFirst = (a: LeadListItem, b: LeadListItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const all = leads ?? [];
    for (const lead of all) {
      if (lead.salesAgentId && WORKING.includes(lead.stage) && !lead.handedOverAt) load.set(lead.salesAgentId, (load.get(lead.salesAgentId) ?? 0) + 1);
    }
    return {
      toDispatch: all.filter((l) => !l.circuit && !['PAID', 'LOST'].includes(l.stage)).sort(oldestFirst),
      toAssign: all.filter((l) => l.circuit === 'SALES_TEAM' && l.stage === 'REGISTERED' && !l.salesAgentId).sort(oldestFirst),
      returned: all.filter((l) => l.followUpReturnedAt && !['PAID', 'LOST'].includes(l.stage) && (canAttribute ? l.circuit === 'SALES_TEAM' : l.circuit === 'OFFICE_MANAGER')),
      workload: load,
    };
  }, [leads, canAttribute]);

  if (!access.manageLeads) {
    return (
      <div className="space-y-6">
        <PageTitle hue="blue" title="À aiguiller" />
        <EmptyState
          icon={Lock}
          title="Réservé au responsable commercial et à l’Office Manager"
          description="L’aiguillage et l’attribution des leads leur reviennent. Vos leads sont dans le pipeline."
          action={
            <Link href="/admin/crm/pipeline?assignee=me" className="text-sm font-semibold text-brand-blue hover:underline">
              Ouvrir mon pipeline
            </Link>
          }
        />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number; icon: typeof Inbox; show: boolean }[] = [
    { key: 'aiguiller', label: 'À aiguiller', count: toDispatch.length, icon: Inbox, show: true },
    { key: 'attribuer', label: 'À attribuer (circuit 1)', count: toAssign.length, icon: UserCheck, show: canAttribute },
    { key: 'relances', label: 'Revenus sans réponse', count: returned.length, icon: RotateCcw, show: true },
  ];
  const go = (key: Tab) => router.replace(`${pathname}?tab=${key}`);

  return (
    <div className="space-y-6">
      <PageTitle
        hue="blue"
        title="À aiguiller"
        description="Le prospect a-t-il besoin d’un travail de qualification et de traitement commercial ? Oui : circuit 1, la Sales Team. Non (événement, recommandation, prospect déjà prêt) : circuit 2, l’Office Manager."
        actions={
          <>
            <Link href="/admin/services-demandes" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
              <ClipboardList className="h-4 w-4" /> Demandes du site
            </Link>
            <Link href="/admin/contact" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
              <Mail className="h-4 w-4" /> Messages de contact
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Enregistrer un lead
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Files d’attente" className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => go(t.key)}
              className={cn('inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition-colors', tab === t.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              <span className={cn('rounded-pill px-2 text-xs tabular-nums', tab === t.key ? 'bg-white/20' : 'bg-ink-900/8')}>{t.count}</span>
            </button>
          ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : tab === 'aiguiller' ? (
        toDispatch.length === 0 ? (
          <EmptyState icon={Inbox} title="Rien à aiguiller" description="Les inscriptions, demandes de devis, messages et recommandations arrivent ici." className="py-12" />
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {toDispatch.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} accent="orange">
                  <p className="text-xs text-ink-500">
                    Circuit suggéré d’après le canal : <strong className="text-ink-800">{CIRCUIT[suggestCircuit(lead)].label}</strong>
                  </p>
                  <DispatchControl lead={lead} compact />
                </LeadCard>
              </li>
            ))}
          </ul>
        )
      ) : tab === 'attribuer' ? (
        toAssign.length === 0 ? (
          <EmptyState icon={UserCheck} title="Rien à attribuer" description="Les leads aiguillés vers la Sales Team attendent ici un commercial." className="py-12" />
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {toAssign.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} accent="blue">
                  <AssignControl leadId={lead.id} current={null} workload={workload} />
                </LeadCard>
              </li>
            ))}
          </ul>
        )
      ) : returned.length === 0 ? (
        <EmptyState icon={RotateCcw} title="Aucun lead revenu sans réponse" description="Après le nombre de relances fixé dans les paramètres, un lead revient ici pour être réattribué ou clôturé." className="py-12" />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {returned.map((lead) => (
            <li key={lead.id}>
              <LeadCard lead={lead} accent="yellow">
                <p className="text-xs text-ink-500">
                  {lead.followUpCount} relance{lead.followUpCount > 1 ? 's' : ''} sans réponse · suivi par {staffName(lead.assignedTo)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {canAttribute && lead.circuit === 'SALES_TEAM' && <AssignControl leadId={lead.id} current={lead.salesAgentId} workload={workload} className="flex-1" />}
                  <Button size="sm" variant="outline" onClick={() => setClosing(lead.id)}>
                    Clôturer
                  </Button>
                </div>
              </LeadCard>
            </li>
          ))}
        </ul>
      )}

      <LeadFormModal open={creating} onClose={() => setCreating(false)} />
      {closing && <LoseModal leadId={closing} open onClose={() => setClosing(null)} />}
    </div>
  );
}

export default function IncomingLeadsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <IncomingLeads />
    </Suspense>
  );
}
