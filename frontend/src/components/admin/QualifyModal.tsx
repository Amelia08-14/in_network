'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Snowflake, Sun } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, Field } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { OFFER_OPTIONS, originLabel, PRIORITY, TONE_CLASS } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { LeadDetail, LeadPriority } from '@/types/crm';

const PRIORITY_ICON = { COLD: Snowflake, WARM: Sun, HOT: Flame } as const;

export type QualifiableLead = Pick<LeadDetail, 'id' | 'reference' | 'title' | 'contactName' | 'companyName' | 'source' | 'channel' | 'pipeline' | 'channelDetail' | 'notes' | 'priority' | 'offerInterest' | 'qualification'>;

// Qualification et orientation (phase 2 du processus v1.3), par le commercial
// attribué (circuit 1) ou l'Office Manager (circuit 2) :
// 1. comprendre le profil, le projet, son étape et le besoin réel ;
// 2. orienter vers l'offre adaptée.
export function QualifyModal({ lead, onClose, onDone }: { lead: QualifiableLead | null; onClose: () => void; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const q = lead?.qualification ?? {};
  const [form, setForm] = useState({
    priority: (lead?.priority ?? 'WARM') as LeadPriority,
    profile: q.profile ?? '',
    project: q.project ?? '',
    maturity: q.maturity ?? '',
    need: q.need ?? '',
    budget: q.budget ?? '',
    decisionMaker: q.decisionMaker ?? '',
    timeline: q.timeline ?? '',
    notes: q.notes ?? '',
    offerInterest: lead?.offerInterest ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const qualify = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${lead!.id}/qualify`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
      queryClient.invalidateQueries({ queryKey: ['admin-home'] });
      onDone?.();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      title={lead ? `Qualifier ${lead.reference}` : 'Qualifier'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={qualify.isPending} onClick={() => qualify.mutate()}>
            {qualify.isPending ? 'Enregistrement…' : 'Enregistrer la qualification'}
          </Button>
        </>
      }
    >
      {lead && (
        <div className="space-y-5">
          <div className="rounded-xl bg-ink-900/[0.04] px-4 py-3 text-sm">
            <p className="font-semibold text-ink-900">{lead.title}</p>
            <p className="mt-0.5 text-ink-600">
              {lead.contactName}
              {lead.companyName ? ` · ${lead.companyName}` : ''} · {originLabel(lead)}
            </p>
            {lead.notes && <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-ink-500">{lead.notes}</p>}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">1 · Comprendre</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Profil" htmlFor="q-profile">
                <Input id="q-profile" value={form.profile} onChange={(e) => set({ profile: e.target.value })} placeholder="Freelance, startup, PME, diaspora…" />
              </Field>
              <Field label="Étape du projet" htmlFor="q-maturity">
                <Input id="q-maturity" value={form.maturity} onChange={(e) => set({ maturity: e.target.value })} placeholder="Idée, création en cours, en activité…" />
              </Field>
              <Field label="Projet" htmlFor="q-project" className="sm:col-span-2">
                <Textarea id="q-project" rows={2} value={form.project} onChange={(e) => set({ project: e.target.value })} placeholder="Activité, ambitions, contexte" />
              </Field>
              <Field label="Besoin réel" htmlFor="q-need" className="sm:col-span-2">
                <Textarea id="q-need" rows={2} value={form.need} onChange={(e) => set({ need: e.target.value })} placeholder="Espace, adresse, création, réseau, lancement…" />
              </Field>
              <Field label="Budget" htmlFor="q-budget">
                <Input id="q-budget" value={form.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="Ex. 100 000 DA, à définir" />
              </Field>
              <Field label="Décideur" htmlFor="q-decider">
                <Input id="q-decider" value={form.decisionMaker} onChange={(e) => set({ decisionMaker: e.target.value })} placeholder="Le contact décide-t-il seul ?" />
              </Field>
              <Field label="Délai" htmlFor="q-timeline">
                <Input id="q-timeline" value={form.timeline} onChange={(e) => set({ timeline: e.target.value })} placeholder="Ex. dès le mois prochain" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">2 · Orienter</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Offre pressentie" htmlFor="q-offer">
                <Select id="q-offer" value={form.offerInterest} onChange={(e) => set({ offerInterest: e.target.value })}>
                  <option value="">À déterminer</option>
                  {OFFER_OPTIONS.map((offer) => (
                    <option key={offer} value={offer}>
                      {offer}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink-800">Température</span>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Température du lead">
                  {(Object.keys(PRIORITY) as LeadPriority[]).map((p) => {
                    const Icon = PRIORITY_ICON[p];
                    const on = form.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ priority: p })}
                        className={cn('flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors', on ? cn(TONE_CLASS[PRIORITY[p].tone], 'border-current') : 'border-ink-900/10 text-ink-600 hover:bg-ink-900/5')}
                      >
                        <Icon className="h-4 w-4" /> {PRIORITY[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Notes" htmlFor="q-notes" className="sm:col-span-2">
                <Textarea id="q-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-brand-orange" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
