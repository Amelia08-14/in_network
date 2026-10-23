'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, CheckCircle2, Coins, Inbox, PackageCheck, Receipt, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageTitle, Pill } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { APPOINTMENT_LABEL, dateTimeFr } from '@/lib/crm';
import { HUE, type Hue } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/store/admin-auth';
import type { HomeData, HomeQueue, PilotageKpi } from '@/types/crm';

// « Ma journée » : la page d'accueil de chaque profil du processus v1.3.
// D'abord ce qui attend une action du compte (files d'attente calculées par
// l'API selon ses droits), puis son agenda du jour et, pour la Direction et le
// responsable commercial, les indicateurs de pilotage face aux objectifs.

const GROUPS: { key: HomeQueue['group']; title: string; hue: Hue; icon: LucideIcon }[] = [
  { key: 'Prospects', title: 'Prospects', hue: 'blue', icon: Inbox },
  { key: 'Ventes', title: 'Ventes', hue: 'orange', icon: Receipt },
  { key: 'Clients', title: 'Clients', hue: 'green', icon: PackageCheck },
  { key: 'Commissions', title: 'Commissions', hue: 'amber', icon: Coins },
];

const KPI_TONE: Record<PilotageKpi['status'], string> = {
  good: 'text-green-700',
  watch: 'text-brand-orange',
  info: 'text-ink-700',
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function MyDayPage() {
  const user = useAdminAuthStore((s) => s.user);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-home'],
    queryFn: () => api.get<{ data: HomeData }>('/api/admin/home').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const name = user?.displayName || user?.email?.split('@')[0] || '';
  const queues = data?.queues ?? [];
  const pending = queues.filter((q) => q.count > 0);

  return (
    <div className="space-y-8">
      <PageTitle
        hue="ink"
        title={`${greeting()}${name ? ` ${name}` : ''}`}
        description={
          data
            ? `${data.roleLabel} · ${pending.length ? `${pending.reduce((sum, q) => sum + q.count, 0)} élément${pending.length > 1 ? 's' : ''} attendent votre action` : 'rien n’attend votre action pour l’instant'}${data.myMembers ? ` · référent de ${data.myMembers} membre${data.myMembers > 1 ? 's' : ''}` : ''}.`
            : 'Ce qui vous attend aujourd’hui.'
        }
      />

      {isLoading && <p className="text-sm text-ink-500">Chargement…</p>}
      {isError && <p className="text-sm text-brand-orange">Votre journée n’a pas pu être chargée. Réessayez dans un instant.</p>}

      {data && (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {pending.length === 0 && (
              <Card>
                <CardContent className="flex items-center gap-3 py-8 text-sm text-ink-600">
                  <CheckCircle2 className="h-5 w-5 text-accent-green" /> Tout est à jour : aucune file d’attente pour vous.
                </CardContent>
              </Card>
            )}
            <div className="grid gap-6 md:grid-cols-2">
              {GROUPS.map((group) => {
                const items = queues.filter((q) => q.group === group.key);
                if (items.length === 0) return null;
                return (
                  <Card key={group.key} accent={group.hue === 'amber' ? 'yellow' : group.hue === 'gray' ? 'none' : (group.hue as 'blue' | 'orange' | 'green')}>
                    <CardContent className="space-y-3">
                      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                        <group.icon className={cn('h-4 w-4', HUE[group.hue].text)} /> {group.title}
                      </h2>
                      <ul className="divide-y divide-ink-900/8">
                        {items.map((q) => (
                          <li key={q.key}>
                            <Link href={q.href} className="group flex items-center justify-between gap-4 py-3">
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-ink-900 group-hover:text-brand-blue">{q.label}</span>
                                <span className="block text-xs text-ink-500">{q.hint}</span>
                              </span>
                              <span
                                className={cn(
                                  'inline-flex min-w-9 justify-center rounded-pill px-2.5 py-0.5 font-heading text-sm font-bold tabular-nums',
                                  q.count === 0 ? 'bg-ink-900/5 text-ink-400' : q.alert ? 'bg-brand-orange/12 text-brand-orange' : 'bg-ink-900/8 text-ink-900',
                                )}
                              >
                                {q.count}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {data.kpis && (
              <section aria-labelledby="pilotage-title" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="pilotage-title" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
                    <Target className="h-4 w-4 text-violet-700" /> Indicateurs de pilotage
                  </h2>
                  <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline">
                    Tableau commercial <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.kpis.map((kpi) => (
                    <div key={kpi.key} className="rounded-2xl border border-ink-900/8 bg-white p-4 shadow-soft">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">{kpi.label}</p>
                      <p className={cn('mt-1.5 font-heading text-2xl font-bold tabular-nums', kpi.value === null ? 'text-ink-300' : KPI_TONE[kpi.status])}>
                        {kpi.value === null ? '—' : `${kpi.value.toLocaleString('fr-FR')}${kpi.unit ? ` ${kpi.unit}` : ''}`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                        <span>Objectif {kpi.target}</span>
                        {kpi.detail && <span aria-hidden>·</span>}
                        {kpi.detail && <span>{kpi.detail}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <Card accent="ink">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                  <CalendarClock className="h-4 w-4 text-ink-500" /> Mon agenda du jour
                </h2>
                <Link href="/admin/crm/agenda" className="text-sm font-medium text-brand-blue hover:underline">
                  Agenda
                </Link>
              </div>
              {data.agenda.length === 0 ? (
                <p className="py-4 text-sm text-ink-500">Aucun rendez-vous ni appel prévu aujourd’hui.</p>
              ) : (
                <ul className="space-y-2">
                  {data.agenda.map((a) => (
                    <li key={a.id}>
                      <Link href={a.lead ? `/admin/crm/leads/${a.lead.id}` : '/admin/crm/agenda'} className="block rounded-xl border border-ink-900/8 px-3 py-2.5 hover:bg-ink-900/3">
                        <span className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-ink-900">{APPOINTMENT_LABEL[a.type]}</span>
                          {a.overdue ? <Pill tone="orange">En retard</Pill> : <span className="text-xs tabular-nums text-ink-500">{dateTimeFr(a.startAt)}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">
                          {a.lead ? `${a.lead.reference} · ${a.lead.contactName}` : ''}
                          {a.notes ? ` — ${a.notes}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
