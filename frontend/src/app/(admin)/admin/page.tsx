'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, CheckCircle2, CreditCard, FileText, Receipt, Rocket, Target, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { StatWidget } from '@/components/features/StatWidget';
import { Avatar, Kpi, PageTitle, StageBadge } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, money, STAGES } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { HUE } from '@/lib/palette';
import type { CrmDashboard, LeadListItem } from '@/types/crm';

interface AdminStats {
  totalMembers: number;
  newMembersLast30Days: number;
  activeSubscriptions: number;
  upcomingBookings: number;
  totalRevenue: number | string;
  revenueByMonth: { month: string; value: number }[];
}

interface Validations {
  pendingEvents: unknown[];
  pendingServiceRequests: unknown[];
  pendingBankTransfers: unknown[];
  pendingMembers: unknown[];
}

const monthLabel = (month: string) => {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
};

interface Todo {
  label: string;
  count: number;
  href: string;
  alert?: boolean;
}

// Vue d'ensemble du back-office : l'état du lieu (membres, abonnements,
// réservations), de la chaîne commerciale (lead → devis → facture → lancement)
// et la liste de ce qui attend l'équipe. Chaque bloc n'apparaît que si le
// compte a le droit correspondant (une requête refusée masque simplement son bloc).
export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/api/admin/stats').then((r) => r.data),
    retry: false,
  });
  const { data: crm } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get<{ data: CrmDashboard }>('/api/admin/crm/dashboard').then((r) => r.data),
    retry: false,
  });
  const { data: validations } = useQuery({
    queryKey: ['admin-validations-overview'],
    queryFn: () => api.get<{ data: Validations }>('/api/admin/validations').then((r) => r.data),
    retry: false,
  });
  const { data: leads } = useQuery({
    queryKey: ['crm-leads', 'overview'],
    queryFn: () => api.get<{ data: LeadListItem[] }>('/api/admin/crm/leads').then((r) => r.data),
    enabled: Boolean(crm),
    retry: false,
  });

  const newLeads = crm?.stages.find((s) => s.stage === 'NEW')?.count ?? 0;
  const pendingValidations = validations
    ? validations.pendingEvents.length + validations.pendingServiceRequests.length + validations.pendingBankTransfers.length + validations.pendingMembers.length
    : 0;

  const todos: Todo[] = [
    { label: 'Nouveaux leads à traiter', count: newLeads, href: '/admin/crm/pipeline' },
    { label: 'Actions commerciales en retard', count: crm?.kpis.overdueActions ?? 0, href: '/admin/crm/pipeline', alert: true },
    { label: 'Rendez-vous aujourd’hui', count: crm?.kpis.appointmentsToday ?? 0, href: '/admin/crm/agenda' },
    { label: 'Factures échues à relancer', count: crm?.kpis.overdueInvoices ?? 0, href: '/admin/factures', alert: true },
    { label: 'Services payés à lancer', count: crm?.kpis.servicesToLaunch ?? 0, href: '/admin/lancements' },
    { label: 'Validations en attente (événements, membres, virements, demandes)', count: pendingValidations, href: '/admin/validations' },
  ].filter((t) => t.count > 0);

  const revenue = (stats?.revenueByMonth ?? []).map((p) => ({ ...p, label: monthLabel(p.month) }));
  const maxStage = Math.max(1, ...(crm?.stages.map((s) => s.count) ?? [1]));
  const recentLeads = (leads ?? []).slice(0, 6);

  return (
    <div className="space-y-8">
      <PageTitle hue="blue" title="Vue d'ensemble" description="IN NETWORK Hydra, Alger — le lieu, la communauté et l’activité commerciale." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatWidget hue="blue" icon={Users} label="Membres" value={stats?.totalMembers ?? '—'} hint={stats ? `+${stats.newMembersLast30Days} sur 30 jours` : undefined} />
        <StatWidget hue="green" icon={CreditCard} label="Abonnements actifs" value={stats?.activeSubscriptions ?? '—'} />
        <StatWidget hue="teal" icon={CalendarCheck} label="Réservations à venir" value={stats?.upcomingBookings ?? '—'} />
        <StatWidget hue="orange" icon={TrendingUp} label="Revenu total" value={stats ? money(stats.totalRevenue) : '—'} hint="Paiements et factures payées" />
      </div>
      {!statsLoading && !stats && <p className="text-sm text-brand-orange">Les statistiques du lieu sont indisponibles (droits insuffisants ou serveur injoignable).</p>}

      {crm && (
        <section aria-label="Chaîne commerciale" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
              <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', HUE.orange.solid)} /> Chaîne commerciale
            </h2>
            <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline">
              Tableau commercial <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi hue="blue" icon={Target} label="1 · Leads ouverts" value={String(crm.kpis.openLeads)} hint={`Pipeline : ${money(crm.kpis.pipelineAmount)}`} href="/admin/crm/pipeline" />
            <Kpi hue="amber" icon={FileText} label="2 · Devis en attente" value={String(crm.kpis.pendingQuotes)} hint={money(crm.kpis.pendingQuotesAmount)} href="/admin/devis" />
            <Kpi hue="orange" icon={Receipt} label="3 · À encaisser" value={money(crm.kpis.receivableAmount)} hint={crm.kpis.overdueInvoices ? `${crm.kpis.overdueInvoices} échue(s)` : 'Aucun retard'} tone={crm.kpis.overdueInvoices ? 'alert' : undefined} href="/admin/factures" />
            <Kpi hue="green" icon={Rocket} label="4 · Services à lancer" value={String(crm.kpis.servicesToLaunch)} hint={`Encaissé ce mois : ${money(crm.kpis.revenueThisMonth)}`} href="/admin/lancements" />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card accent="orange">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">À traiter</h2>
            {todos.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-sm text-ink-500">
                <CheckCircle2 className="h-5 w-5 text-accent-green" /> Tout est à jour, rien n’attend l’équipe.
              </p>
            ) : (
              <ul className="divide-y divide-ink-900/8">
                {todos.map((t) => (
                  <li key={t.label}>
                    <Link href={t.href} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-brand-orange">
                      <span className="text-ink-800">{t.label}</span>
                      <span className={cn('inline-flex min-w-8 justify-center rounded-pill px-2.5 py-0.5 font-heading text-sm font-bold tabular-nums', t.alert ? 'bg-brand-orange/12 text-brand-orange' : 'bg-ink-900/8 text-ink-900')}>{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card accent="green">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Encaissements, 12 mois</h2>
            {revenue.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-500">Pas encore de données.</p>
            ) : (
              <div className="h-52" role="img" aria-label="Montants encaissés par mois sur les 12 derniers mois">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue} margin={{ left: 4, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="#0F1B2E14" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))} width={44} />
                    <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => String(label)} />
                    <Bar dataKey="value" name="Encaissé" fill={HUE.green.hex} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {crm && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card accent="blue">
            <CardContent className="space-y-3">
              <h2 className="font-heading text-base font-bold text-ink-900">Pipeline par étape</h2>
              <ul className="space-y-2.5">
                {STAGES.map((s) => {
                  const row = crm.stages.find((x) => x.stage === s.value);
                  const count = row?.count ?? 0;
                  return (
                    <li key={s.value} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                      <span className="text-ink-700">{s.label}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-ink-900/6">
                        <span className={cn('block h-full rounded-full', HUE[s.tone].solid)} style={{ width: `${(count / maxStage) * 100}%` }} />
                      </span>
                      <span className="w-24 text-right tabular-nums text-ink-600">
                        <strong className="text-ink-900">{count}</strong>
                        {row && row.amount > 0 ? ` · ${money(row.amount)}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card accent="teal">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink-900">Derniers leads</h2>
                <Link href="/admin/crm/pipeline" className="text-sm font-medium text-brand-blue hover:underline">
                  Voir le pipeline
                </Link>
              </div>
              {recentLeads.length === 0 ? (
                <p className="py-6 text-sm text-ink-500">Aucun lead pour l’instant : ils arrivent ici dès qu’un visiteur demande un devis ou écrit via le formulaire de contact.</p>
              ) : (
                <ul className="divide-y divide-ink-900/8">
                  {recentLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/admin/crm/leads/${lead.id}`} className="flex items-center gap-3 py-2.5 hover:bg-ink-900/3">
                        <Avatar user={lead.assignedTo} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">{lead.title}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {lead.reference} · {lead.companyName || lead.contactName} · {dateFr(lead.createdAt)}
                          </span>
                        </span>
                        <StageBadge stage={lead.stage} />
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
