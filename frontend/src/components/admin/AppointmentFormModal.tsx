'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, Field, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { APPOINTMENT_LABEL, staffName, toInputDateTime } from '@/lib/crm';
import type { AppointmentType, LeadListItem } from '@/types/crm';

// Programmation d'un rendez-vous (appel, visite, réunion) sur un lead. Depuis
// la fiche, le lead est fixé ; depuis l'agenda, on le choisit dans la liste.
export function AppointmentFormModal({
  open,
  onClose,
  leadId,
  defaultStart,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: string;
  defaultStart?: Date;
}) {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const { data: leads } = useQuery({
    queryKey: ['crm-leads', 'for-appointment'],
    queryFn: () => api.get<{ data: LeadListItem[] }>('/api/admin/crm/leads').then((r) => r.data),
    enabled: open && !leadId,
  });
  const initialStart = () => {
    const d = defaultStart ? new Date(defaultStart) : new Date(Date.now() + 24 * 3600 * 1000);
    if (!defaultStart) d.setHours(10, 0, 0, 0);
    return toInputDateTime(d);
  };
  const [form, setForm] = useState(() => ({ leadId: leadId ?? '', type: 'MEETING' as AppointmentType, startAt: initialStart(), endAt: '', location: '', assignee: '', notes: '' }));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const targetLead = leadId ?? form.leadId;

  const create = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/crm/leads/${targetLead}/appointments`, {
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        location: form.location,
        notes: form.notes,
        ...(form.assignee ? { assigneeId: form.assignee } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
      queryClient.invalidateQueries({ queryKey: ['crm-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Programmer un rendez-vous"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={create.isPending || !targetLead || !form.startAt} onClick={() => create.mutate()}>
            {create.isPending ? 'Enregistrement…' : 'Programmer'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!leadId && (
          <Field label="Lead *" htmlFor="appt-lead" className="sm:col-span-2">
            <Select id="appt-lead" value={form.leadId} onChange={(e) => set({ leadId: e.target.value })}>
              <option value="">Choisir un lead…</option>
              {leads?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.reference} — {l.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Type" htmlFor="appt-type">
          <Select id="appt-type" value={form.type} onChange={(e) => set({ type: e.target.value as AppointmentType })}>
            {(Object.keys(APPOINTMENT_LABEL) as AppointmentType[]).map((t) => (
              <option key={t} value={t}>
                {APPOINTMENT_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Avec" htmlFor="appt-assignee">
          <Select id="appt-assignee" value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
            <option value="">Moi</option>
            {staff?.map((u) => (
              <option key={u.id} value={u.id}>
                {staffName(u)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Début *" htmlFor="appt-start">
          <Input id="appt-start" type="datetime-local" value={form.startAt} onChange={(e) => set({ startAt: e.target.value })} />
        </Field>
        <Field label="Fin" htmlFor="appt-end">
          <Input id="appt-end" type="datetime-local" value={form.endAt} onChange={(e) => set({ endAt: e.target.value })} />
        </Field>
        <Field label="Lieu" htmlFor="appt-location" className="sm:col-span-2">
          <Input id="appt-location" value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Adresse du client, visio, dans nos locaux…" />
        </Field>
        <Field label="Notes" htmlFor="appt-notes" className="sm:col-span-2">
          <Textarea id="appt-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
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
