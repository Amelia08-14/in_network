'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Banknote, CalendarClock, FileText, Percent, Plus, Receipt, RefreshCw, Rocket, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadFormModal } from '@/components/admin/LeadFormModal';
import { errorMessage, Kpi, PageTitle } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { money, SOURCE_LABEL } from '@/lib/crm';
import { HUE } from '@/lib/palette';
import type { CrmDashboard } from '@/types/crm';

// Palette recharts alignée sur la charte (navy + orange), pas de violet.
const NAVY = HUE.blue.hex;
const ORANGE = HUE.orange.hex;
const STAGE_COLORS: Record<string, string> = { NEW: HUE.blue.hex, CONTACTED: HUE.teal.hex, QUALIFIED: HUE.amber.hex, QUOTE_SENT: HUE.orange.hex, WON: HUE.green.hex, LOST: HUE.gray.hex };

interface AutomationResult {
  quotesExpired: number;
  quoteReminders: number;
  invoiceReminders: number;
  followUpAlerts: number;
  dormantAlerts: number;
  appointmentReminders: number;
}

const AUTOMATIONS = [
  'Relance automatique des devis sans réponse (email au client, tous les 3 jours, 2 fois maximum)',
  'Expiration des devis dont la validité est dépassée',
  'Rappel de paiement des factures échues (email au client, chaque semaine, 3 fois maximum)',
  'Alerte au commercial quand une action planifiée arrive à échéance',
  'Alerte sur les leads sans activité depuis 7 jours',
  'Rappel des rendez-vous dans les 24 heures',
];

export default function CrmDashboardPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get<{ data: CrmDashboard }>('/api/admin/crm/dashboard').then((r) => r.data),
  });

  const runAutomations = useMutation({
    mutationFn: () => api.post<{ data: AutomationResult }>('/api/admin/crm/automations/run').then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] }),
  });

  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!data) return <EmptyState title="Tableau de bord indisponible" description="Vérifiez vos droits d’accès au CRM." />;

  const { kpis } = data;
  const funnel = data.stages.map((s) => ({ ...s, name: s.label }));
  const sources = data.sources.map((s) => ({ name: SOURCE_LABEL[s.source], count: s.count }));
  const result = runAutomations.data;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Tableau commercial"
        description="Du lead à la facture et au lancement du service : l’essentiel de l’activité de l’équipe."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau lead
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi hue="blue" icon={Target} label="Leads ouverts" value={String(kpis.openLeads)} hint={`Pipeline : ${money(kpis.pipelineAmount)}`} href="/admin/crm/pipeline" />
        <Kpi hue="green" icon={Banknote} label="Encaissé ce mois" value={money(kpis.revenueThisMonth)} hint={`${kpis.wonThisMonth} facture${kpis.wonThisMonth > 1 ? 's' : ''} payée${kpis.wonThisMonth > 1 ? 's' : ''}`} href="/admin/factures" />
        <Kpi hue="teal" icon={Percent} label="Taux de conversion" value={kpis.conversionRate == null ? '—' : `${kpis.conversionRate} %`} hint="Gagnés / clôturés, 90 derniers jours" />
        <Kpi hue="amber" icon={FileText} label="Devis en attente" value={String(kpis.pendingQuotes)} hint={money(kpis.pendingQuotesAmount)} href="/admin/devis" />
        <Kpi hue="orange" icon={Receipt} label="À encaisser" value={money(kpis.receivableAmount)} hint={kpis.overdueInvoices ? `${kpis.overdueInvoices} facture${kpis.overdueInvoices > 1 ? 's' : ''} échue${kpis.overdueInvoices > 1 ? 's' : ''}` : 'Aucun retard'} tone={kpis.overdueInvoices ? 'alert' : undefined} href="/admin/factures" />
        <Kpi hue="green" icon={Rocket} label="Services à lancer" value={String(kpis.servicesToLaunch)} hint="Factures payées, à démarrer" href="/admin/lancements" />
        <Kpi hue="blue" icon={CalendarClock} label="Rendez-vous" value={`${kpis.appointmentsToday} aujourd’hui`} hint={`${kpis.appointmentsWeek} dans les 7 prochains jours`} href="/admin/crm/agenda" />
        <Kpi hue="red" icon={AlertTriangle} label="Actions en retard" value={String(kpis.overdueActions)} hint="Leads dont l’action prévue est dépassée" tone={kpis.overdueActions ? 'alert' : undefined} href="/admin/crm/pipeline" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card accent="blue">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Entonnoir commercial</h2>
            <div className="h-64" role="img" aria-label="Nombre de leads par étape du pipeline">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#0F1B2E14" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, _n, item) => [`${value} lead(s) · ${money((item.payload as { amount: number }).amount)}`, '']} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {funnel.map((s) => (
                      <Cell key={s.stage} fill={STAGE_COLORS[s.stage]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card accent="orange">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Encaissements et nouveaux leads, 6 mois</h2>
            <div className="h-64" role="img" aria-label="Chiffre d’affaires encaissé et nombre de leads créés par mois">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="#0F1B2E14" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 12 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))} />
                  <YAxis yAxisId="leads" orientation="right" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name) => (name === 'Encaissé' ? money(Number(value)) : `${value} lead(s)`)} />
                  <Line yAxisId="rev" type="monotone" dataKey="revenue" name="Encaissé" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="leads" type="monotone" dataKey="leads" name="Nouveaux leads" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card accent="teal">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Origine des leads</h2>
            {sources.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-500">Aucun lead pour l’instant.</p>
            ) : (
              <div className="h-64" role="img" aria-label="Nombre de leads par source">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sources} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#0F1B2E14" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill={HUE.teal.hex} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card accent="green">
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold text-ink-900">Leads ouverts par commercial</h2>
            {data.assignees.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-500">Aucun lead ouvert.</p>
            ) : (
              <ul className="divide-y divide-ink-900/8">
                {data.assignees.map((a) => (
                  <li key={a.id ?? 'none'} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-ink-800">{a.name}</span>
                    <span className="font-heading font-bold tabular-nums text-ink-900">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card accent="orange">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-bold text-ink-900">Automatisations actives</h2>
              <p className="mt-1 text-sm text-ink-500">Exécutées automatiquement chaque heure ; vous pouvez les lancer tout de suite.</p>
            </div>
            <Button variant="outline" disabled={runAutomations.isPending} onClick={() => runAutomations.mutate()}>
              <RefreshCw className={runAutomations.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Exécuter maintenant
            </Button>
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-600">
            {AUTOMATIONS.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {runAutomations.isError && <p className="text-sm text-brand-orange">{errorMessage(runAutomations.error)}</p>}
          {result && (
            <p className="rounded-xl bg-ink-900/4 px-4 py-3 text-sm text-ink-700" role="status">
              Terminé : {result.quoteReminders} relance(s) de devis, {result.invoiceReminders} rappel(s) de facture, {result.quotesExpired} devis expiré(s), {result.followUpAlerts} action(s) à mener, {result.dormantAlerts} lead(s) dormant(s), {result.appointmentReminders} rappel(s) de rendez-vous.
            </p>
          )}
        </CardContent>
      </Card>

      <LeadFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
