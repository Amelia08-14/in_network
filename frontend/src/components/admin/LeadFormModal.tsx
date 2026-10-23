'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, Field, OfficeManagerOptions, SalesAgentOptions, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { CHANNELS, OFFER_OPTIONS, PIPELINE } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { LeadChannel, LeadCircuit, LeadPipeline } from '@/types/crm';

type CircuitChoice = 'none' | LeadCircuit;

const EMPTY = {
  title: '',
  contactName: '',
  email: '',
  phone: '',
  companyName: '',
  channel: '' as LeadChannel | '',
  channelDetail: '',
  offerInterest: '',
  expectedAmount: '',
  circuit: 'none' as CircuitChoice,
  assignee: '',
  nextActionAt: '',
  notes: '',
};

// Fiche lead unique (processus v1.3) : chaque prospect est enregistré dès
// l'entrée avec sa source (pipeline et canal), son profil, son circuit et son
// intervenant. L'Office Manager enregistre ses leads en circuit 2, un
// commercial sa prospection en circuit 1 ; le responsable commercial et la
// Direction peuvent aiguiller dès la saisie. Un contact déjà suivi est refusé.
export function LeadFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const access = useCrmAccess();
  const isAgent = !access.manageLeads && !access.allLeads;
  const [form, setForm] = useState({ ...EMPTY, circuit: (access.officeManager ? 'OFFICE_MANAGER' : access.salesManager ? 'SALES_TEAM' : 'none') as CircuitChoice });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const create = useMutation({
    mutationFn: () =>
      api.post<{ data: { id: string } }>('/api/admin/crm/leads', {
        title: form.title,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        companyName: form.companyName,
        channel: form.channel || null,
        channelDetail: form.channelDetail,
        offerInterest: form.offerInterest,
        expectedAmount: form.expectedAmount === '' ? null : Number(form.expectedAmount),
        notes: form.notes,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
        ...(isAgent ? {} : { circuit: form.circuit === 'none' ? null : form.circuit }),
        ...(!isAgent && form.assignee ? { assignedToId: form.assignee } : {}),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-home'] });
      setForm(EMPTY);
      onClose();
      router.push(`/admin/crm/leads/${res.data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const circuitChoices: { value: CircuitChoice; label: string; hint: string }[] = access.officeManager
    ? [
        { value: 'OFFICE_MANAGER', label: 'Je le prends en charge', hint: 'Circuit 2 : événement, recommandation, prospect déjà prêt' },
        { value: 'SALES_TEAM', label: 'Le confier à la Sales Team', hint: 'Circuit 1 : demande un travail de qualification' },
      ]
    : [
        { value: 'SALES_TEAM', label: 'Circuit 1 · Sales Team', hint: 'Prospection, lead à travailler' },
        { value: 'OFFICE_MANAGER', label: 'Circuit 2 · Office Manager', hint: 'Prospect déjà prêt' },
        ...(access.direction ? [{ value: 'none' as CircuitChoice, label: 'À aiguiller plus tard', hint: 'Le lead attend dans « À aiguiller »' }] : []),
      ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrer un lead"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={create.isPending || !form.title.trim() || !form.contactName.trim()} onClick={() => create.mutate()}>
            {create.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Titre de l’opportunité *" htmlFor="lead-title" className="sm:col-span-2">
          <Input id="lead-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. Création de SARL + domiciliation" autoFocus />
        </Field>
        <Field label="Nom du contact *" htmlFor="lead-contact">
          <Input id="lead-contact" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label="Entreprise" htmlFor="lead-company">
          <Input id="lead-company" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="lead-email">
          <Input id="lead-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Téléphone" htmlFor="lead-phone">
          <Input id="lead-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Canal d’entrée" htmlFor="lead-channel">
          <Select id="lead-channel" value={form.channel} onChange={(e) => set({ channel: e.target.value as LeadChannel | '' })}>
            <option value="">À préciser</option>
            {(Object.keys(PIPELINE) as LeadPipeline[]).map((pipeline) => (
              <optgroup key={pipeline} label={PIPELINE[pipeline].label}>
                {CHANNELS.filter((c) => c.pipeline === pipeline).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Précision sur le canal" htmlFor="lead-channel-detail">
          <Input id="lead-channel-detail" value={form.channelDetail} onChange={(e) => set({ channelDetail: e.target.value })} placeholder="Nom de l’événement, du cabinet, de la campagne…" />
        </Field>
        <Field label="Offre pressentie" htmlFor="lead-offer">
          <Select id="lead-offer" value={form.offerInterest} onChange={(e) => set({ offerInterest: e.target.value })}>
            <option value="">À déterminer</option>
            {OFFER_OPTIONS.map((offer) => (
              <option key={offer} value={offer}>
                {offer}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Montant estimé (DA)" htmlFor="lead-amount">
          <Input id="lead-amount" type="number" min="0" value={form.expectedAmount} onChange={(e) => set({ expectedAmount: e.target.value })} />
        </Field>

        {isAgent ? (
          <p className="rounded-xl bg-ink-900/[0.04] px-3 py-2.5 text-xs text-ink-600 sm:col-span-2">
            Le lead est enregistré dans votre prospection (circuit 1) : il vous est attribué et le responsable commercial en est informé.
          </p>
        ) : (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-ink-800">Circuit</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {circuitChoices.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={form.circuit === c.value}
                  onClick={() => set({ circuit: c.value, assignee: '' })}
                  className={cn('rounded-xl border px-3 py-2.5 text-left text-sm', form.circuit === c.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/10 text-ink-700 hover:bg-ink-900/5')}
                >
                  <span className="block font-semibold">{c.label}</span>
                  <span className={cn('block text-xs', form.circuit === c.value ? 'text-white/70' : 'text-ink-500')}>{c.hint}</span>
                </button>
              ))}
            </div>
            {form.circuit === 'SALES_TEAM' && (access.salesManager || access.direction) && (
              <Select aria-label="Commercial" value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
                <option value="">Attribuer plus tard</option>
                <SalesAgentOptions staff={staff} />
              </Select>
            )}
            {form.circuit === 'OFFICE_MANAGER' && !access.officeManager && (
              <Select aria-label="Office Manager" value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
                <option value="">Office Manager…</option>
                <OfficeManagerOptions staff={staff} />
              </Select>
            )}
          </fieldset>
        )}

        <Field label="Prochaine action" htmlFor="lead-next">
          <Input id="lead-next" type="datetime-local" value={form.nextActionAt} onChange={(e) => set({ nextActionAt: e.target.value })} />
        </Field>
        <Field label="Notes" htmlFor="lead-notes" className="sm:col-span-2">
          <Textarea id="lead-notes" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {error && (
          <p className="text-sm text-brand-orange sm:col-span-2" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
