'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AssigneeOptions, errorMessage, Field, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { SOURCE_LABEL } from '@/lib/crm';
import type { LeadSource } from '@/types/crm';

const SOURCES = Object.keys(SOURCE_LABEL).filter((s) => s !== 'WEBSITE_QUOTE' && s !== 'CONTACT_FORM') as LeadSource[];

const EMPTY = { title: '', contactName: '', email: '', phone: '', companyName: '', source: 'PHONE' as LeadSource, expectedAmount: '', assignee: '', nextActionAt: '', notes: '' };

// Création manuelle d'un lead (appel entrant, visite, recommandation…). Les
// leads du site et du formulaire de contact arrivent, eux, automatiquement.
export function LeadFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const access = useCrmAccess();
  const [form, setForm] = useState(EMPTY);
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
        source: form.source,
        expectedAmount: form.expectedAmount === '' ? null : Number(form.expectedAmount),
        notes: form.notes,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
        // Seul le responsable commercial choisit le commercial ; sinon le lead arrive « À qualifier ».
        ...(access.manageLeads && form.assignee ? { assignedToId: form.assignee } : {}),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      setForm(EMPTY);
      onClose();
      router.push(`/admin/crm/leads/${res.data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau lead"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={create.isPending || !form.title.trim() || !form.contactName.trim()} onClick={() => create.mutate()}>
            {create.isPending ? 'Création…' : 'Créer le lead'}
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
        <Field label="Source" htmlFor="lead-source">
          <Select id="lead-source" value={form.source} onChange={(e) => set({ source: e.target.value as LeadSource })}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Montant estimé (DA)" htmlFor="lead-amount">
          <Input id="lead-amount" type="number" min="0" value={form.expectedAmount} onChange={(e) => set({ expectedAmount: e.target.value })} />
        </Field>
        {access.manageLeads ? (
          <Field label="Assigner à" htmlFor="lead-assignee">
            <Select id="lead-assignee" value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
              <option value="">Aucun — à qualifier d’abord</option>
              <AssigneeOptions staff={staff} />
            </Select>
            <p className="mt-1 text-xs text-ink-500">Un lead assigné dès sa création est considéré comme validé.</p>
          </Field>
        ) : (
          <p className="self-end rounded-xl bg-ink-900/[0.04] px-3 py-2.5 text-xs text-ink-600">
            Le lead vous sera attribué et le responsable commercial le validera (étape « À qualifier »).
          </p>
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
