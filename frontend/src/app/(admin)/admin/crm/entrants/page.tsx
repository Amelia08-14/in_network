'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, ClipboardCheck, Inbox, Lock, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AssignControl } from '@/components/admin/AssignControl';
import { QualifyModal, type QualifiableLead } from '@/components/admin/QualifyModal';
import { Pill, PageTitle, PriorityBadge, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, money, SOURCE_LABEL } from '@/lib/crm';
import type { LeadListItem } from '@/types/crm';

const WORKING_STAGES = ['ASSIGNED', 'CONTACTED', 'QUOTE_SENT'];

// File d'attente du responsable commercial : qualifier et valider les leads entrants,
// puis les assigner à son équipe. Un seul flux — une fois assigné, le lead vit dans
// le pipeline du commercial.
export default function IncomingLeadsPage() {
  const access = useCrmAccess();
  const [qualifying, setQualifying] = useState<QualifiableLead | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['crm-leads', 'queue'],
    queryFn: () => api.get<{ data: LeadListItem[] }>('/api/admin/crm/leads').then((r) => r.data),
    enabled: access.manageLeads,
  });

  const { toQualify, toAssign, workload } = useMemo(() => {
    const load = new Map<string, number>();
    const inbox: LeadListItem[] = [];
    const assign: LeadListItem[] = [];
    for (const lead of leads ?? []) {
      if (lead.stage === 'NEW') inbox.push(lead);
      else if (lead.stage === 'QUALIFIED') assign.push(lead);
      else if (lead.assignedToId && WORKING_STAGES.includes(lead.stage)) load.set(lead.assignedToId, (load.get(lead.assignedToId) ?? 0) + 1);
    }
    // Les plus anciens d'abord : ce sont ceux qui attendent depuis le plus longtemps.
    const oldestFirst = (a: LeadListItem, b: LeadListItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return { toQualify: inbox.sort(oldestFirst), toAssign: assign.sort(oldestFirst), workload: load };
  }, [leads]);

  if (!access.manageLeads) {
    return (
      <div className="space-y-6">
        <PageTitle hue="blue" title="Leads à traiter" />
        <EmptyState icon={Lock} title="Réservé au responsable commercial" description="La qualification, la validation et l’assignation des leads relèvent du responsable commercial. Vos leads assignés sont dans le pipeline." action={<Link href="/admin/crm/pipeline" className="text-sm font-semibold text-brand-blue hover:underline">Ouvrir mon pipeline</Link>} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle
        hue="blue"
        title="Leads à traiter"
        description="Les demandes du site, les inscriptions et les contacts arrivent ici : qualifiez-les, validez-les, puis assignez-les à votre équipe commerciale."
      />

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section aria-labelledby="to-qualify" className="space-y-3">
            <h2 id="to-qualify" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
              <Inbox className="h-5 w-5 text-brand-blue" /> À qualifier
              <Pill tone="blue">{toQualify.length}</Pill>
            </h2>
            {toQualify.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Rien à qualifier" description="Tous les leads entrants ont été traités." className="py-10" />
            ) : (
              <ul className="space-y-3">
                {toQualify.map((lead) => (
                  <li key={lead.id}>
                    <Card accent="blue">
                      <CardContent className="relative space-y-3 transition-colors hover:bg-ink-900/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-wide text-ink-400">
                              {lead.reference} · reçu le {dateFr(lead.createdAt)}
                            </p>
                            <Link href={`/admin/crm/leads/${lead.id}`} className="mt-0.5 block font-semibold leading-snug text-ink-900 hover:underline after:absolute after:inset-0 after:content-['']">
                              {lead.title}
                            </Link>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{lead.companyName || lead.contactName}</span>
                            </p>
                          </div>
                          {lead.expectedAmount && <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">{money(lead.expectedAmount)}</span>}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Pill tone="gray">{SOURCE_LABEL[lead.source]}</Pill>
                          <Button size="sm" className="relative z-10" onClick={() => setQualifying(lead)}>
                            <ClipboardCheck className="h-4 w-4" /> Qualifier
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="to-assign" className="space-y-3">
            <h2 id="to-assign" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
              <UserCheck className="h-5 w-5 text-amber-700" /> À assigner
              <Pill tone="amber">{toAssign.length}</Pill>
            </h2>
            {toAssign.length === 0 ? (
              <EmptyState icon={UserCheck} title="Rien à assigner" description="Les leads validés apparaissent ici, en attente d’un commercial." className="py-10" />
            ) : (
              <ul className="space-y-3">
                {toAssign.map((lead) => (
                  <li key={lead.id}>
                    <Card accent="yellow">
                      <CardContent className="relative space-y-3 transition-colors hover:bg-ink-900/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-wide text-ink-400">{lead.reference}</p>
                            <Link href={`/admin/crm/leads/${lead.id}`} className="mt-0.5 block font-semibold leading-snug text-ink-900 hover:underline after:absolute after:inset-0 after:content-['']">
                              {lead.title}
                            </Link>
                            <p className="mt-1 text-sm text-ink-600">{lead.companyName || lead.contactName}</p>
                          </div>
                          <PriorityBadge priority={lead.priority} />
                        </div>
                        <AssignControl leadId={lead.id} current={null} workload={workload} className="relative z-10" />
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <QualifyModal key={qualifying?.id ?? 'none'} lead={qualifying} onClose={() => setQualifying(null)} />
    </div>
  );
}
