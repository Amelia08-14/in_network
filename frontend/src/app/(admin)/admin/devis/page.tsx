'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { LineItemsEditor } from '@/components/admin/LineItemsEditor';
import { errorMessage, Field, PageTitle, QuoteBadge } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateFr, money, QUOTE_STATUS } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { DocLine, QuoteListItem, QuoteStatus, QuoteTemplate } from '@/types/crm';

type Tab = 'quotes' | 'templates';

export default function QuotesPage() {
  const [tab, setTab] = useState<Tab>('quotes');
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [search, setSearch] = useState('');

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());
  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', params.toString()],
    queryFn: () => api.get<{ data: QuoteListItem[] }>(`/api/admin/quotes?${params}`).then((r) => r.data),
    enabled: tab === 'quotes',
  });

  return (
    <div className="space-y-6">
      <PageTitle hue="amber" title="Devis" description="Créés depuis la fiche d’un lead : depuis un modèle, depuis la demande du site ou à partir de zéro." />

      <div className="inline-flex rounded-xl border border-ink-900/10 bg-white p-1" role="tablist">
        {(['quotes', 'templates'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-lg px-4 py-1.5 text-sm font-medium', tab === t ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/5')}>
            {t === 'quotes' ? 'Devis' : 'Modèles de devis'}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <Templates />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input aria-label="Rechercher un devis" className="h-10 w-64" placeholder="N° de devis, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
              {(['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const).map((s) => (
                <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn('rounded-pill px-3.5 py-1.5 text-sm font-medium', status === s ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
                  {s ? QUOTE_STATUS[s].label : 'Tous'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-500">Chargement…</p>
          ) : !quotes || quotes.length === 0 ? (
            <EmptyState title="Aucun devis" description="Ouvrez la fiche d’un lead et cliquez sur « Créer un devis »." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white shadow-soft">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Devis</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Total TTC</th>
                    <th className="px-4 py-3">Valable jusqu’au</th>
                    <th className="px-4 py-3">Créé le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {quotes.map((q) => (
                    <tr key={q.id} className="hover:bg-ink-900/3">
                      <td className="px-4 py-3">
                        <Link href={`/admin/devis/${q.id}`} className="font-semibold text-ink-900 hover:underline">
                          {q.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {q.lead.companyName || q.lead.contactName}
                        <span className="block text-xs text-ink-500">
                          {q.lead.reference} · {q.lead.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <QuoteBadge status={q.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{money(q.total)}</td>
                      <td className="px-4 py-3 text-ink-600">{dateFr(q.validUntil)}</td>
                      <td className="px-4 py-3 text-ink-500">{dateFr(q.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Templates() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<QuoteTemplate> | null>(null);
  const { data: templates, isLoading } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: () => api.get<{ data: QuoteTemplate[] }>('/api/admin/quotes/templates').then((r) => r.data),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/quotes/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote-templates'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500">Un modèle pré-remplit les lignes, la validité et les notes d’un devis en un clic.</p>
        <Button onClick={() => setEditing({ name: '', validityDays: 15, lines: [{ description: '', quantity: 1, unitPrice: 0 }], isActive: true })}>
          <Plus className="h-4 w-4" /> Nouveau modèle
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : !templates || templates.length === 0 ? (
        <EmptyState title="Aucun modèle" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-2xl border border-ink-900/8 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-base font-bold text-ink-900">{t.name}</h3>
                  {t.description && <p className="text-sm text-ink-500">{t.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button type="button" aria-label={`Modifier ${t.name}`} onClick={() => setEditing(t)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-900/5">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${t.name}`}
                    onClick={() => window.confirm(`Supprimer le modèle « ${t.name} » ?`) && remove.mutate(t.id)}
                    className="rounded-lg p-2 text-ink-500 hover:bg-brand-orange/10 hover:text-brand-orange"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink-700">
                {t.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{l.description}</span>
                    <span className="shrink-0 tabular-nums text-ink-500">{money(l.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-400">Valable {t.validityDays} jours</p>
            </li>
          ))}
        </ul>
      )}
      {editing && <TemplateModal template={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateModal({ template, onClose }: { template: Partial<QuoteTemplate>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template.name ?? '');
  const [description, setDescription] = useState(template.description ?? '');
  const [validityDays, setValidityDays] = useState(String(template.validityDays ?? 15));
  const [notes, setNotes] = useState(template.notes ?? '');
  const [lines, setLines] = useState<DocLine[]>((template.lines ?? []).map((l) => ({ ...l, quantity: l.quantity ?? 1 })));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description,
        validityDays: Number(validityDays) || 15,
        notes,
        lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 1, unitPrice: Number(l.unitPrice) || 0, serviceSlug: l.serviceSlug ?? undefined, tierLabel: l.tierLabel ?? undefined })),
      };
      return template.id ? api.patch(`/api/admin/quotes/templates/${template.id}`, body) : api.post('/api/admin/quotes/templates', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={template.id ? 'Modifier le modèle' : 'Nouveau modèle de devis'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || !name.trim() || lines.length === 0} onClick={() => save.mutate()}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nom *" htmlFor="tpl-name" className="sm:col-span-2">
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Validité (jours)" htmlFor="tpl-validity">
            <Input id="tpl-validity" type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="tpl-desc" className="sm:col-span-3">
            <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <LineItemsEditor lines={lines} onChange={setLines} vatRate={19} />
        <Field label="Notes reprises sur le devis" htmlFor="tpl-notes">
          <Textarea id="tpl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p className="text-sm text-brand-orange" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
