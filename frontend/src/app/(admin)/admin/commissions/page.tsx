'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { CircuitBadge, CommissionBadge, errorMessage, ErrorNote, Field, PageTitle, Pill, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { CIRCUIT, COMMISSION_STATUS, dateFr, KIND, money, staffName } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { Commission, CommissionBeneficiary, CommissionRule, CommissionStatus, LeadCircuit, LeadKind, StaffUser } from '@/types/crm';

// Commissions (phase 8 du processus v1.3). Le fait générateur est le paiement
// encaissé : une commission est calculée par ligne payée pour le commercial
// closer (circuit 1) et l'Office Manager (circuits 1 et 2), selon le barème.
// Elle devient éligible quand le service est livré, est contrôlée par le
// responsable commercial (circuit 1), validée par la Direction, puis versée.

type Tab = 'suivi' | 'releve' | 'bareme';

const ROLE_LABEL: Record<CommissionBeneficiary, string> = { CLOSER: 'Commercial closer', OFFICE_MANAGER: 'Office Manager' };

const CATEGORY_LABEL: Record<string, string> = {
  DOMICILIATION: 'Domiciliation',
  CREATION_ENTREPRISE: 'Création d’entreprise',
  ADMINISTRATION: 'Administration',
  COMPTABILITE: 'Comptabilité',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  SECRETARIAT: 'Secrétariat',
  OFFRE: 'Offres',
  DIASPORA: 'Diaspora',
  INCUBATION: 'Incubation',
  AUTRE: 'Autre',
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Commissions() {
  const access = useCrmAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'suivi';
  const tabs: [Tab, string][] = [
    ['suivi', access.direction || access.salesManager ? 'À traiter' : 'Mes commissions'],
    ['releve', 'Relevé mensuel'],
    ['bareme', 'Barème'],
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        hue="amber"
        title="Commissions"
        description="Calculées au paiement encaissé, selon le barème ; éligibles une fois le service livré ; contrôlées par le responsable commercial (circuit 1), validées par la Direction, puis versées. Un remboursement les reprend."
      />
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => router.replace(`${pathname}?tab=${key}`)}
            className={cn('rounded-pill px-4 py-2 text-sm font-semibold', tab === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'suivi' && <Tracking initialStatus={(params.get('status') as CommissionStatus | null) ?? ''} />}
      {tab === 'releve' && <Statement />}
      {tab === 'bareme' && <Rules />}
    </div>
  );
}

function Tracking({ initialStatus }: { initialStatus: CommissionStatus | '' }) {
  const access = useCrmAccess();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CommissionStatus | ''>(initialStatus);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['commissions', status],
    queryFn: () => api.get<{ data: Commission[] }>(`/api/admin/commissions${status ? `?status=${status}` : ''}`).then((r) => r.data),
  });
  const act = useMutation({
    mutationFn: (path: 'check' | 'validate' | 'pay') => api.post<{ data: { count: number } }>(`/api/admin/commissions/${path}`, { ids: selected }).then((r) => r.data),
    onSuccess: (r, path) => {
      setError(null);
      setNotice(`${r.count} commission${r.count > 1 ? 's' : ''} ${path === 'check' ? 'contrôlée' : path === 'validate' ? 'validée' : 'versée'}${r.count > 1 ? 's' : ''}.`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-home'] });
    },
    onError: (e) => {
      setNotice(null);
      setError(errorMessage(e));
    },
  });

  const list = rows ?? [];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const canAct = access.direction || access.salesManager;
  const total = list.filter((r) => r.status !== 'CANCELLED').reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['', 'PENDING', 'ELIGIBLE', 'CHECKED', 'VALIDATED', 'PAID', 'CANCELLED'] as const).map((s) => (
          <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn('rounded-pill px-3.5 py-1.5 text-sm font-medium', status === s ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
            {s ? COMMISSION_STATUS[s].label : 'Toutes'}
          </button>
        ))}
        <span className="ml-auto text-sm text-ink-600">
          Total affiché : <strong className="tabular-nums text-ink-900">{money(total)}</strong>
        </span>
      </div>

      {canAct && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-900/[0.04] px-4 py-3 text-sm">
          <span className="text-ink-600">{selected.length} sélectionnée(s) :</span>
          {access.salesManager && (
            <Button size="sm" variant="outline" disabled={!selected.length || act.isPending} onClick={() => act.mutate('check')}>
              Contrôler (circuit 1)
            </Button>
          )}
          {access.direction && (
            <>
              <Button size="sm" variant="outline" disabled={!selected.length || act.isPending} onClick={() => act.mutate('validate')}>
                Valider
              </Button>
              <Button size="sm" disabled={!selected.length || act.isPending} onClick={() => act.mutate('pay')}>
                Marquer versées
              </Button>
            </>
          )}
        </div>
      )}
      <ErrorNote message={error} />
      {notice && <p className="rounded-xl bg-accent-green/15 px-4 py-2.5 text-sm text-green-800">{notice}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : list.length === 0 ? (
        <EmptyState title="Aucune commission" description="Les commissions sont calculées à l’enregistrement d’un paiement, selon le barème saisi par la Direction." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                {canAct && <th className="w-10 px-4 py-3" />}
                <th className="px-4 py-3">Client et service</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Circuit</th>
                <th className="px-4 py-3 text-right">Base HT</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Payée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-ink-900/3">
                  {canAct && (
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Sélectionner ${c.description}`} className="h-4 w-4" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {c.lead ? (
                      <Link href={`/admin/crm/leads/${c.lead.id}`} className="font-medium text-ink-900 hover:underline">
                        {c.lead.companyName || c.lead.contactName}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink-900">—</span>
                    )}
                    <span className="block text-xs text-ink-500">
                      {c.description} · {c.invoice.number}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {staffName(c.beneficiary)}
                    <span className="block text-xs text-ink-500">{ROLE_LABEL[c.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <CircuitBadge circuit={c.lead?.circuit ?? null} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-600">{money(c.baseAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-900">{money(c.amount)}</td>
                  <td className="px-4 py-3">
                    <CommissionBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-500">{dateFr(c.invoice.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface StatementData {
  month: string;
  beneficiaries: { beneficiary: StaffUser; total: number; validated: number; paid: number; lines: Commission[] }[];
}

function Statement() {
  const [month, setMonth] = useState(thisMonth());
  const { data, isLoading } = useQuery({
    queryKey: ['commission-statement', month],
    queryFn: () => api.get<{ data: StatementData }>(`/api/admin/commissions/statement?month=${month}`).then((r) => r.data),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  return (
    <div className="space-y-4">
      <Field label="Mois (paiements encaissés)" htmlFor="st-month" className="max-w-xs">
        <Input id="st-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : !data || data.beneficiaries.length === 0 ? (
        <EmptyState title="Aucune commission ce mois-ci" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.beneficiaries.map((b) => (
            <Card key={b.beneficiary.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-base font-bold text-ink-900">{staffName(b.beneficiary)}</h3>
                    <p className="text-xs text-ink-500">
                      Validées : {money(b.validated)} · Versées : {money(b.paid)}
                    </p>
                  </div>
                  <span className="font-heading text-lg font-bold tabular-nums text-ink-900">{money(b.total)}</span>
                </div>
                <ul className="divide-y divide-ink-900/8 text-sm">
                  {b.lines.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-ink-800">{l.lead?.companyName || l.lead?.contactName || '—'}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {l.description} · {l.invoice.number}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <CommissionBadge status={l.status} />
                        <span className={cn('tabular-nums', l.status === 'CANCELLED' && 'text-red-700')}>
                          {l.status === 'CANCELLED' ? '−' : ''}
                          {money(l.amount)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface CatalogOption {
  id: string;
  title?: string;
  name?: string;
}

const EMPTY_RULE = { beneficiary: 'CLOSER' as CommissionBeneficiary, target: '', category: '', leadKind: '' as '' | LeadKind, circuit: '' as '' | LeadCircuit, mode: 'RATE' as 'RATE' | 'FIXED', value: '' };

function Rules() {
  const access = useCrmAccess();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_RULE);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof EMPTY_RULE>) => setForm((f) => ({ ...f, ...patch }));

  const { data: rules } = useQuery({ queryKey: ['commission-rules'], queryFn: () => api.get<{ data: CommissionRule[] }>('/api/admin/commissions/rules').then((r) => r.data) });
  const { data: services } = useQuery({ queryKey: ['catalog-services'], queryFn: () => api.get<{ data: CatalogOption[] }>('/api/services').then((r) => r.data), enabled: access.direction });
  const { data: plans } = useQuery({ queryKey: ['catalog-plans'], queryFn: () => api.get<{ data: CatalogOption[] }>('/api/plans').then((r) => r.data), enabled: access.direction });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['commission-rules'] });
  const create = useMutation({
    mutationFn: () => {
      const [kind, id] = form.target.split(':');
      return api.post('/api/admin/commissions/rules', {
        beneficiary: form.beneficiary,
        serviceId: kind === 'service' ? id : null,
        planId: kind === 'plan' ? id : null,
        category: form.category || null,
        leadKind: form.leadKind || null,
        circuit: form.circuit || null,
        mode: form.mode,
        value: Number(form.value),
      });
    },
    onSuccess: () => {
      setForm(EMPTY_RULE);
      setError(null);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (rule: CommissionRule) => api.patch(`/api/admin/commissions/rules/${rule.id}`, { isActive: !rule.isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/commissions/rules/${id}`), onSuccess: refresh });

  const scopeLabel = useMemo(
    () => (r: CommissionRule) =>
      [r.service?.title ?? r.plan?.name ?? (r.category ? `Catégorie ${CATEGORY_LABEL[r.category] ?? r.category}` : 'Tous les services'), r.leadKind ? KIND[r.leadKind].label : null, r.circuit ? CIRCUIT[r.circuit].short : null].filter(Boolean).join(' · '),
    [],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        La règle la plus précise l’emporte : service ou formule, puis catégorie, puis règle générale. Un taux s’applique au montant HT de la ligne payée ; un montant fixe, par unité vendue. Sans règle applicable, aucune commission n’est calculée.
      </p>
      {!rules || rules.length === 0 ? (
        <EmptyState title="Barème vide" description="Aucune commission n’est calculée tant que la Direction n’a pas saisi de règle." className="py-8" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">S’applique à</th>
                <th className="px-4 py-3 text-right">Valeur</th>
                <th className="px-4 py-3">État</th>
                {access.direction && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/8">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-ink-800">{ROLE_LABEL[r.beneficiary]}</td>
                  <td className="px-4 py-3 text-ink-600">{scopeLabel(r)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.mode === 'RATE' ? `${Number(r.value)} %` : money(r.value)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Active' : 'Suspendue'}</Pill>
                  </td>
                  {access.direction && (
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="mr-3 text-xs font-medium text-brand-blue hover:underline" onClick={() => toggle.mutate(r)}>
                        {r.isActive ? 'Suspendre' : 'Réactiver'}
                      </button>
                      <button type="button" aria-label="Supprimer la règle" className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-orange/10 hover:text-brand-orange" onClick={() => remove.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {access.direction && (
        <Card accent="yellow">
          <CardContent className="space-y-4">
            <h2 className="font-heading text-base font-bold text-ink-900">Nouvelle règle</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bénéficiaire" htmlFor="r-ben">
                <Select id="r-ben" value={form.beneficiary} onChange={(e) => set({ beneficiary: e.target.value as CommissionBeneficiary })}>
                  <option value="CLOSER">Commercial closer (circuit 1)</option>
                  <option value="OFFICE_MANAGER">Office Manager</option>
                </Select>
              </Field>
              <Field label="Service ou formule" htmlFor="r-target">
                <Select id="r-target" value={form.target} onChange={(e) => set({ target: e.target.value })}>
                  <option value="">Tous (ou selon la catégorie)</option>
                  <optgroup label="Services">
                    {services?.map((s) => (
                      <option key={s.id} value={`service:${s.id}`}>
                        {s.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Formules">
                    {plans?.map((p) => (
                      <option key={p.id} value={`plan:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
              <Field label="Catégorie" htmlFor="r-cat">
                <Select id="r-cat" value={form.category} disabled={Boolean(form.target)} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">Toutes</option>
                  {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type d’affaire" htmlFor="r-kind">
                <Select id="r-kind" value={form.leadKind} onChange={(e) => set({ leadKind: e.target.value as '' | LeadKind })}>
                  <option value="">Toutes</option>
                  {(Object.keys(KIND) as LeadKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND[k].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Circuit" htmlFor="r-circuit">
                <Select id="r-circuit" value={form.circuit} onChange={(e) => set({ circuit: e.target.value as '' | LeadCircuit })}>
                  <option value="">Les deux</option>
                  {(Object.keys(CIRCUIT) as LeadCircuit[]).map((c) => (
                    <option key={c} value={c}>
                      {CIRCUIT[c].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valeur" htmlFor="r-value">
                <div className="flex gap-2">
                  <Select aria-label="Mode" className="w-28" value={form.mode} onChange={(e) => set({ mode: e.target.value as 'RATE' | 'FIXED' })}>
                    <option value="RATE">%</option>
                    <option value="FIXED">DA</option>
                  </Select>
                  <Input id="r-value" type="number" min="0" step="0.01" value={form.value} onChange={(e) => set({ value: e.target.value })} />
                </div>
              </Field>
            </div>
            <ErrorNote message={error} />
            <div className="flex justify-end">
              <Button disabled={create.isPending || !(Number(form.value) > 0)} onClick={() => create.mutate()}>
                <Plus className="h-4 w-4" /> Ajouter la règle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CommissionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <Commissions />
    </Suspense>
  );
}
