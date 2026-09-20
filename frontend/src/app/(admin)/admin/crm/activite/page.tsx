'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, errorMessage, Field, Kpi, PageTitle, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { ACTIVITY_LABEL, MANUAL_ACTIVITY_TYPES, staffName, toInputDate, toInputDateTime } from '@/lib/crm';
import type { ActivityType, LeadActivity, LeadListItem } from '@/types/crm';

interface ActivityRow extends LeadActivity {
  lead: { id: string; reference: string; title: string; contactName: string; companyName: string | null };
}

// Reporting d'activité : le journal de toute l'équipe, filtrable par
// commercial, type, période, avec regroupement par jour et compteurs.
export default function ActivityPage() {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const [authorId, setAuthorId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 7 * 24 * 3600 * 1000)));
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const params = new URLSearchParams();
  if (authorId) params.set('authorId', authorId);
  if (type) params.set('type', type);
  if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
  if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
  if (search.trim()) params.set('search', search.trim());

  const { data: activities, isLoading } = useQuery({
    queryKey: ['crm-activities', params.toString()],
    queryFn: () => api.get<{ data: ActivityRow[] }>(`/api/admin/crm/activities?${params}`).then((r) => r.data),
  });

  // Les événements automatiques (changements d'étape, relances…) noient le
  // reporting : masqués par défaut, visibles avec le filtre « Système ».
  const rows = useMemo(() => (activities ?? []).filter((a) => type === 'SYSTEM' || a.type !== 'SYSTEM'), [activities, type]);
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const a of rows) {
      const key = new Date(a.occurredAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [rows]);

  const contacts = rows.filter((a) => ['CALL', 'EMAIL', 'MEETING', 'VISIT'].includes(a.type)).length;
  const countBy = (t: ActivityType) => rows.filter((a) => a.type === t).length;

  return (
    <div className="space-y-6">
      <PageTitle
        hue="green"
        title="Activité commerciale"
        description="Le journal de l’équipe : appels, visites, emails et notes, par jour."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter mon reporting
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi hue="blue" label="Contacts effectués" value={String(contacts)} hint="Appels, emails, réunions, visites" />
        <Kpi hue="teal" label="Appels" value={String(countBy('CALL'))} />
        <Kpi hue="orange" label="Visites et réunions" value={String(countBy('VISIT') + countBy('MEETING'))} />
        <Kpi hue="amber" label="Notes" value={String(countBy('NOTE'))} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Commercial" htmlFor="act-author">
          <Select id="act-author" className="h-10 w-48" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
            <option value="">Toute l’équipe</option>
            {staff?.map((u) => (
              <option key={u.id} value={u.id}>
                {staffName(u)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" htmlFor="act-type">
          <Select id="act-type" className="h-10 w-40" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous</option>
            {(Object.keys(ACTIVITY_LABEL) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Du" htmlFor="act-from">
          <Input id="act-from" type="date" className="h-10" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Au" htmlFor="act-to">
          <Input id="act-to" type="date" className="h-10" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Recherche" htmlFor="act-search">
          <Input id="act-search" className="h-10 w-56" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Texte, client, lead…" />
        </Field>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : grouped.length === 0 ? (
        <EmptyState title="Aucune activité sur cette période" />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold capitalize text-ink-900">
                {day} <span className="rounded-pill bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-600">{items.length}</span>
              </h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-ink-900/8">
                    {items.map((a) => (
                      <li key={a.id} className="flex gap-3 px-5 py-3.5">
                        <Avatar user={a.author} />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="text-xs text-ink-500">
                            <span className="font-semibold text-ink-700">{a.author ? staffName(a.author) : 'Système'}</span>
                            {a.type !== 'SYSTEM' && ` · ${ACTIVITY_LABEL[a.type]}`} ·{' '}
                            {new Date(a.occurredAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                            <Link href={`/admin/crm/leads/${a.lead.id}`} className="font-medium text-brand-blue hover:underline">
                              {a.lead.reference} {a.lead.companyName || a.lead.contactName}
                            </Link>
                          </p>
                          <p className="mt-0.5 whitespace-pre-line text-ink-800">{a.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}

      <ReportingModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['crm-activities'] });
          queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
        }}
      />
    </div>
  );
}

// « Ajouter mon reporting » : rattacher une activité du jour à une opportunité.
function ReportingModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { data: leads } = useQuery({
    queryKey: ['crm-leads', 'for-reporting'],
    queryFn: () => api.get<{ data: LeadListItem[] }>('/api/admin/crm/leads').then((r) => r.data),
    enabled: open,
  });
  const [leadId, setLeadId] = useState('');
  const [type, setType] = useState<ActivityType>('CALL');
  const [occurredAt, setOccurredAt] = useState(() => toInputDateTime(new Date()));
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${leadId}/activities`, { type, content, occurredAt: new Date(occurredAt).toISOString() }),
    onSuccess: () => {
      setContent('');
      setLeadId('');
      setError(null);
      onSaved();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter mon reporting"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || !leadId || !content.trim()} onClick={() => save.mutate()}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opportunité du jour *" htmlFor="rep-lead" className="sm:col-span-2">
          <Select id="rep-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Choisir dans la base de leads…</option>
            {leads?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.reference} — {l.companyName || l.contactName} · {l.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type de contact" htmlFor="rep-type">
          <Select id="rep-type" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
            {MANUAL_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date et heure" htmlFor="rep-date">
          <Input id="rep-date" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>
        <Field label="Issue du contact *" htmlFor="rep-content" className="sm:col-span-2">
          <Textarea id="rep-content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ce qui s’est dit, la suite prévue…" />
        </Field>
        {error && (
          <p className="text-sm text-brand-orange sm:col-span-2" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
