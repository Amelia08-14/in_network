'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileText,
  Minus,
  ShieldCheck,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { errorMessage, PageTitle } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { money } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { ROLE_LABEL } from '@/types';
import type { ComparedValue, Overview, OverviewPeriod } from '@/types/crm';

// Tableau de bord de la Direction (retours du 22/11/2026 : « un vrai dashboard
// d'admin principal, des chiffres et interactif pour une visibilité globale »).
// Page d'accueil des administrateurs, en consultation : pas de « Ma journée » pour eux (retour du 24/11/2026).
//
// Lecture : d'abord ce qui bloque (alertes cliquables), puis les chiffres de la
// période comparés à la période précédente de même durée, la situation à
// l'instant (encaissements, pipeline, membres, occupation), les tendances sur
// 12 mois, l'entonnoir, les sources, l'activité et l'équipe.
//
// Couleurs des graphiques (validées daltonisme, script dataviz) : bleu #235BA8
// pour les prospects, orange #D44835 pour les clients gagnés ; bleu nuit pour
// la série unique du chiffre d'affaires. Les valeurs restent en encre, jamais
// dans la couleur de la série.

const NAVY = '#001042';
const BLUE = '#235BA8';
const ORANGE = '#D44835';
const GRID = 'rgba(0, 16, 66, 0.08)';
const AXIS = '#6B7280';

const PERIODS: { value: OverviewPeriod; label: string; compare: string }[] = [
  { value: '30d', label: '30 jours', compare: 'vs 30 jours précédents' },
  { value: '90d', label: '90 jours', compare: 'vs 90 jours précédents' },
  { value: '12m', label: '12 mois', compare: 'vs 12 mois précédents' },
];

/** 1 250 000 → « 1,25 M », 85 000 → « 85 k » (axes). */
function compact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k`;
  return value.toLocaleString('fr-FR');
}
const da = (value: number) => money(Math.round(value));

export function DirectionDashboard() {
  const [period, setPeriod] = useState<OverviewPeriod>(() => {
    try {
      const saved = localStorage.getItem('direction-period');
      return saved === '90d' || saved === '12m' ? saved : '30d';
    } catch {
      return '30d';
    }
  });
  const choose = (value: OverviewPeriod) => {
    setPeriod(value);
    try {
      localStorage.setItem('direction-period', value);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  };

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['direction-overview', period],
    queryFn: () => api.get<{ data: Overview }>(`/api/admin/crm/overview?period=${period}`).then((r) => r.data),
    refetchInterval: 120_000,
    placeholderData: (previous) => previous,
  });
  const compare = PERIODS.find((p) => p.value === period)!.compare;
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      <PageTitle
        hue="ink"
        title="Tableau de bord"
        description={`Vue d’ensemble d’IN NETWORK · ${today}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Période" className="inline-flex rounded-xl border border-ink-900/10 bg-white p-1 shadow-soft">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={period === p.value}
                  onClick={() => choose(p.value)}
                  className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors', period === p.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {isLoading && <p className="text-sm text-ink-500">Chargement des chiffres…</p>}
      {isError && (
        // Le message du serveur est affiché tel quel (retour du 24/11/2026 :
        // « ne se charge pas » sans indice sur la cause).
        <p className="text-sm text-brand-orange">
          Le tableau de bord n’a pas pu être chargé ({errorMessage(error)}).{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => refetch()}>
            Réessayer
          </button>
        </p>
      )}

      {data && (
        <div className={cn('space-y-8 transition-opacity', isFetching && 'opacity-70')} aria-busy={isFetching}>
          <Alerts alerts={data.alerts} />

          {/* Chiffres de la période */}
          <section aria-labelledby="kpi-period" className="space-y-3">
            <h2 id="kpi-period" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              Sur la période · {compare}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={Banknote} label="Chiffre d’affaires encaissé" value={da(data.kpis.revenue.value)} compared={data.kpis.revenue} hint={`${data.kpis.paidInvoices.value} facture${data.kpis.paidInvoices.value > 1 ? 's' : ''} payée${data.kpis.paidInvoices.value > 1 ? 's' : ''}`} href="/admin/factures?status=PAID" hero />
              <Stat icon={UserPlus} label="Nouveaux prospects" value={data.kpis.newLeads.value.toLocaleString('fr-FR')} compared={data.kpis.newLeads} hint="Site, inscriptions, contacts, réseaux" href="/admin/crm/pipeline" hero />
              <Stat icon={Target} label="Clients gagnés" value={data.kpis.won.value.toLocaleString('fr-FR')} compared={data.kpis.won} hint="Paiement confirmé" href="/admin/membres" hero />
              <Stat
                icon={TrendingUp}
                label="Taux de conversion"
                value={data.kpis.conversion.closed ? `${data.kpis.conversion.value} %` : '—'}
                compared={data.kpis.conversion}
                unit="pts"
                hint={data.kpis.conversion.closed ? `Sur ${data.kpis.conversion.closed} dossier${data.kpis.conversion.closed > 1 ? 's' : ''} clos (gagnés + perdus)` : 'Aucun dossier clos sur la période'}
                href="/admin/crm"
                hero
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={FileText} label="Devis envoyés" value={data.kpis.quotesSent.value.toLocaleString('fr-FR')} compared={data.kpis.quotesSent} hint={`${da(data.kpis.quotesSent.amount)} TTC proposés`} href="/admin/devis?status=SENT" />
              <Stat icon={Wallet} label="Panier moyen" value={data.kpis.averageBasket.value ? da(data.kpis.averageBasket.value) : '—'} compared={data.kpis.averageBasket} hint="Par facture payée" href="/admin/factures?status=PAID" />
              <Stat icon={Users} label="Nouveaux membres" value={data.kpis.newMembers.value.toLocaleString('fr-FR')} compared={data.kpis.newMembers} hint="Comptes créés" href="/admin/membres" />
              <Stat icon={CalendarClock} label="Échéances à 30 jours" value={data.snapshot.expiringSoon.toLocaleString('fr-FR')} hint="Services à renouveler" href="/admin/lancements?vue=echeances" />
            </div>
          </section>

          {/* Situation à l'instant */}
          <section aria-labelledby="kpi-now" className="space-y-3">
            <h2 id="kpi-now" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              À l’instant
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Banknote}
                label="À encaisser"
                value={da(data.snapshot.receivable)}
                hint={data.snapshot.overdueCount ? `dont ${da(data.snapshot.overdue)} échus (${data.snapshot.overdueCount})` : `${data.snapshot.receivableCount} proforma${data.snapshot.receivableCount > 1 ? 's' : ''} en attente`}
                warn={data.snapshot.overdueCount > 0}
                href="/admin/factures?status=SENT"
              />
              <Stat icon={Target} label="Pipeline en cours" value={da(data.snapshot.pipelineAmount)} hint={`${data.snapshot.openLeads} lead${data.snapshot.openLeads > 1 ? 's' : ''} ouvert${data.snapshot.openLeads > 1 ? 's' : ''} (montants attendus)`} href="/admin/crm/pipeline" />
              <Stat icon={Users} label="Membres actifs" value={data.snapshot.activeMembers.toLocaleString('fr-FR')} hint="Avec au moins un service en cours" href="/admin/membres" />
              <Occupancy occupancy={data.snapshot.occupancy} active={data.snapshot.activeSubs} capacity={data.snapshot.capacity} />
            </div>
          </section>

          <Trends monthly={data.monthly} />

          <div className="grid gap-6 xl:grid-cols-2">
            <Funnel funnel={data.funnel} />
            <div className="space-y-6">
              <Breakdown
                title="D’où viennent les prospects"
                subtitle="Nouveaux leads de la période, par origine"
                rows={data.sources.map((s) => ({ key: s.pipeline ?? 'none', label: s.label, value: s.count, display: s.count.toLocaleString('fr-FR') }))}
                color={BLUE}
                empty="Aucun prospect sur la période."
              />
              <Breakdown
                title="Chiffre d’affaires par activité"
                subtitle="Services des factures payées sur la période"
                rows={data.byPole.map((p) => ({ key: p.pole, label: p.label, value: p.amount, display: da(p.amount) }))}
                color={NAVY}
                empty="Aucun service facturé et payé sur la période."
              />
            </div>
          </div>

          <Team team={data.team} />
        </div>
      )}
    </div>
  );
}

// --- Alertes ------------------------------------------------------------------------

function Alerts({ alerts }: { alerts: Overview['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-green-50 px-5 py-3 text-sm font-medium text-green-900 ring-1 ring-green-200">
        <ShieldCheck className="h-4 w-4" /> Rien ne bloque : aucune validation, aucun paiement ni service en attente.
      </p>
    );
  }
  const [first, ...others] = alerts[0].key === 'approvals' ? alerts : [null, ...alerts];
  return (
    <section aria-label="À traiter" className="space-y-3">
      {first && (
        <Link href={first.href} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-orange px-5 py-4 text-white shadow-soft transition-opacity hover:opacity-95">
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <strong className="font-heading text-base">
              {first.count} demande{first.count > 1 ? 's' : ''} de validation (remise, prix ajusté) vous attend{first.count > 1 ? 'ent' : ''}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-4 py-1.5 text-sm font-semibold text-brand-orange">
            Traiter <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {others.filter(Boolean).map((alert) => (
            <li key={alert!.key}>
              <Link href={alert!.href} className="inline-flex items-center gap-2 rounded-pill border border-ink-900/10 bg-white px-3.5 py-1.5 text-sm text-ink-800 shadow-soft transition-colors hover:border-ink-900/30">
                <AlertTriangle className="h-3.5 w-3.5 text-brand-orange" />
                {alert!.label}
                <span className="rounded-pill bg-ink-900 px-2 py-0.5 text-xs font-bold tabular-nums text-white">{alert!.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Chiffres -------------------------------------------------------------------------

/** Évolution vs période précédente : flèche + texte (jamais la couleur seule). */
function Delta({ compared, unit }: { compared: ComparedValue; unit?: 'pts' }) {
  const { value, previous } = compared;
  if (unit === 'pts') {
    const diff = value - previous;
    if (diff === 0) return <DeltaPill tone="flat" text="stable" />;
    return <DeltaPill tone={diff > 0 ? 'up' : 'down'} text={`${diff > 0 ? '+' : ''}${diff} pts`} />;
  }
  if (previous === 0) return value === 0 ? <DeltaPill tone="flat" text="stable" /> : <DeltaPill tone="up" text="nouveau" />;
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct === 0) return <DeltaPill tone="flat" text="stable" />;
  return <DeltaPill tone={pct > 0 ? 'up' : 'down'} text={`${pct > 0 ? '+' : ''}${pct} %`} />;
}

function DeltaPill({ tone, text }: { tone: 'up' | 'down' | 'flat'; text: string }) {
  const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-xs font-semibold tabular-nums',
        tone === 'up' ? 'bg-green-50 text-green-800' : tone === 'down' ? 'bg-red-50 text-red-800' : 'bg-ink-900/5 text-ink-600',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden /> {text}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  compared,
  unit,
  href,
  hero,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  compared?: ComparedValue;
  unit?: 'pts';
  href: string;
  hero?: boolean;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-2 rounded-2xl border p-5 shadow-soft transition-colors',
        hero ? 'border-ink-900 bg-ink-900 text-white hover:bg-ink-800' : 'border-ink-900/8 bg-white hover:border-ink-900/25',
      )}
    >
      <span className={cn('flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.1em]', hero ? 'text-white/70' : 'text-ink-500')}>
        <span className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', hero ? 'text-white/80' : warn ? 'text-brand-orange' : 'text-ink-400')} /> {label}
        </span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </span>
      <span className="font-heading text-2xl font-bold tabular-nums leading-tight">{value}</span>
      <span className="flex flex-wrap items-center gap-2">
        {compared && <Delta compared={compared} unit={unit} />}
        {hint && <span className={cn('text-xs', hero ? 'text-white/70' : warn ? 'font-semibold text-brand-orange' : 'text-ink-500')}>{hint}</span>}
      </span>
    </Link>
  );
}

function Occupancy({ occupancy, active, capacity }: { occupancy: number | null; active: number; capacity: number }) {
  const value = occupancy ?? 0;
  return (
    <Link href="/admin/lancements" className="group flex flex-col gap-2 rounded-2xl border border-ink-900/8 bg-white p-5 shadow-soft transition-colors hover:border-ink-900/25">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
        <Building2 className="h-4 w-4 text-ink-400" /> Occupation du coworking
      </span>
      <span className="font-heading text-2xl font-bold tabular-nums leading-tight">{occupancy === null ? '—' : `${occupancy} %`}</span>
      <span className="h-2 overflow-hidden rounded-full bg-ink-900/8" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Taux d’occupation">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, background: NAVY }} />
      </span>
      <span className="text-xs text-ink-500">{capacity ? `${active} abonnements actifs / ${capacity} postes · objectif > 65 %` : 'Renseignez la capacité des postes'}</span>
    </Link>
  );
}

// --- Tendances 12 mois -------------------------------------------------------------------

function ChartTooltip({ active, payload, label, money: isMoney }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs shadow-soft">
      <p className="mb-1 font-semibold text-ink-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-700">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name} : <strong className="tabular-nums text-ink-900">{isMoney ? da(p.value) : p.value.toLocaleString('fr-FR')}</strong>
        </p>
      ))}
    </div>
  );
}

function Trends({ monthly }: { monthly: Overview['monthly'] }) {
  const [table, setTable] = useState(false);
  const total = monthly.reduce((s, m) => s + m.revenue, 0);
  const best = monthly.reduce((a, b) => (b.revenue > a.revenue ? b : a), monthly[0]);
  return (
    <section aria-labelledby="trends" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trends" className="font-heading text-lg font-bold text-ink-900">
          Tendances sur 12 mois
        </h2>
        <button type="button" onClick={() => setTable((v) => !v)} aria-expanded={table} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
          {table ? 'Masquer les chiffres' : 'Voir les chiffres'} {table ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-1">
            <h3 className="font-heading text-base font-bold text-ink-900">Chiffre d’affaires encaissé</h3>
            <p className="text-xs text-ink-500">
              {da(total)} sur 12 mois{best && best.revenue > 0 ? ` · meilleur mois : ${best.label} (${da(best.revenue)})` : ''}
            </p>
            <div className="h-64 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={{ fill: 'rgba(0,16,66,0.04)' }} content={<ChartTooltip money />} />
                  <Bar dataKey="revenue" name="Encaissé" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <h3 className="font-heading text-base font-bold text-ink-900">Prospects et clients gagnés</h3>
            <p className="text-xs text-ink-500">
              {monthly.reduce((s, m) => s + m.leads, 0)} prospects · {monthly.reduce((s, m) => s + m.won, 0)} clients gagnés sur 12 mois
            </p>
            <div className="h-64 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip cursor={{ stroke: 'rgba(0,16,66,0.2)' }} content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#374151' }} />
                  <Line type="monotone" dataKey="leads" name="Prospects" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="won" name="Clients gagnés" stroke={ORANGE} strokeWidth={2} dot={{ r: 3, fill: ORANGE, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {table && (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Mois</th>
                <th className="px-4 py-2.5 text-right font-semibold">Encaissé</th>
                <th className="px-4 py-2.5 text-right font-semibold">Prospects</th>
                <th className="px-4 py-2.5 text-right font-semibold">Clients gagnés</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8 tabular-nums">
              {monthly.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-2 text-ink-800">{m.label}</td>
                  <td className="px-4 py-2 text-right text-ink-900">{da(m.revenue)}</td>
                  <td className="px-4 py-2 text-right text-ink-700">{m.leads}</td>
                  <td className="px-4 py-2 text-right text-ink-700">{m.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// --- Entonnoir, répartitions ----------------------------------------------------------------

function Funnel({ funnel }: { funnel: Overview['funnel'] }) {
  const max = Math.max(1, ...funnel.map((f) => f.count));
  const total = funnel.reduce((s, f) => s + f.count, 0);
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-bold text-ink-900">Entonnoir commercial</h2>
            <p className="text-xs text-ink-500">{total} dossiers en cours, par étape · cliquez pour ouvrir le pipeline</p>
          </div>
          <Link href="/admin/crm/pipeline" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
            Pipeline <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="space-y-2.5">
          {funnel.map((step) => (
            <li key={step.stage}>
              <Link href="/admin/crm/pipeline" className="group block rounded-xl px-2 py-1.5 transition-colors hover:bg-ink-900/[0.04]" title={`${step.label} : ${step.count} dossier(s), ${da(step.amount)} attendus`}>
                <span className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-800">{step.label}</span>
                  <span className="tabular-nums text-ink-900">
                    <strong>{step.count}</strong>
                    {step.amount > 0 && <span className="ml-2 text-xs text-ink-500">{da(step.amount)}</span>}
                  </span>
                </span>
                <span className="block h-2.5 rounded-full bg-ink-900/[0.06]">
                  <span className="block h-full rounded-full transition-[width]" style={{ width: `${step.count ? Math.max((step.count / max) * 100, 2) : 0}%`, background: BLUE }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, subtitle, rows, color, empty }: { title: string; subtitle: string; rows: { key: string; label: string; value: number; display: string }[]; color: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="font-heading text-base font-bold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
        {total === 0 ? (
          <p className="text-sm text-ink-500">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.key} title={`${row.label} : ${row.display} (${Math.round((row.value / total) * 100)} %)`}>
                <span className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-800">{row.label}</span>
                  <span className="tabular-nums">
                    <strong className="text-ink-900">{row.display}</strong>
                    <span className="ml-2 text-xs text-ink-500">{Math.round((row.value / total) * 100)} %</span>
                  </span>
                </span>
                <span className="block h-2 rounded-full bg-ink-900/[0.06]">
                  <span className="block h-full rounded-full" style={{ width: `${row.value ? Math.max((row.value / max) * 100, 2) : 0}%`, background: color }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Équipe ------------------------------------------------------------------------------

type TeamSort = 'revenue' | 'won' | 'open';

function Team({ team }: { team: Overview['team'] }) {
  const [sort, setSort] = useState<TeamSort>('revenue');
  const rows = [...team].sort((a, b) => b[sort] - a[sort]);
  const header = (key: TeamSort, label: string) => (
    <th className="px-4 py-2.5 text-right font-semibold" aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(key)} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink-900', sort === key && 'text-ink-900')}>
        {label} {sort === key && <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </th>
  );
  return (
    <section aria-labelledby="team" className="space-y-3">
      <h2 id="team" className="font-heading text-lg font-bold text-ink-900">
        L’équipe sur la période
      </h2>
      {team.length === 0 ? (
        <p className="text-sm text-ink-500">Aucun compte Office Manager ou commercial actif.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide">Membre de l’équipe</th>
                {header('open', 'Leads en cours')}
                {header('won', 'Clients gagnés')}
                {header('revenue', 'CA encaissé')}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8 tabular-nums">
              {rows.map((member) => (
                <tr key={member.id} className="hover:bg-ink-900/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/crm/pipeline?assignee=${member.id}`} className="font-medium text-ink-900 hover:text-brand-blue">
                      {member.name}
                    </Link>
                    <span className="block text-xs text-ink-500">{ROLE_LABEL[member.role] ?? member.role}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-800">{member.open}</td>
                  <td className="px-4 py-2.5 text-right text-ink-800">{member.won}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-ink-900">{da(member.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
