'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, Field, OfficeManagerOptions, SalesAgentOptions, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { usePlatformOptions } from '@/lib/options';
import { APPOINTMENT_LABEL, CIRCUIT, suggestCircuit, toInputDateTime } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { LeadChannel, LeadCircuit, LeadPipeline, StaffUser } from '@/types/crm';

// Gestes du parcours d'un lead (processus v1.3, phases 1 et 2) : aiguillage,
// relance, visite / visio confirmée (transmission à l'Office Manager en
// circuit 1), passerelle entre circuits, clôture. Le serveur vérifie qui a le
// droit de faire quoi ; l'interface ne propose que les gestes du compte.

function useLeadRefresh(leadId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['admin-home'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
  };
}

const omCount = (staff: StaffUser[] | undefined) => (staff ?? []).filter((u) => u.role === 'OFFICE_MANAGER').length;

/**
 * Question d'aiguillage : « le prospect nécessite-t-il un travail de
 * qualification et de traitement commercial ? » Oui : circuit 1 (Sales Team).
 * Non : circuit 2 (Office Manager). Le circuit suggéré dépend du canal.
 */
export function DispatchControl({ lead, compact = false, onDone }: { lead: { id: string; channel: LeadChannel | null; pipeline: LeadPipeline | null }; compact?: boolean; onDone?: () => void }) {
  const access = useCrmAccess();
  const { data: staff } = useStaff();
  const refresh = useLeadRefresh(lead.id);
  const suggested = suggestCircuit(lead);
  const [agent, setAgent] = useState('');
  const [om, setOm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canAttribute = access.salesManager || access.direction;

  const dispatch = useMutation({
    mutationFn: (circuit: LeadCircuit) =>
      api.post(`/api/admin/crm/leads/${lead.id}/dispatch`, {
        circuit,
        assignedToId: circuit === 'SALES_TEAM' ? agent || null : om || null,
      }),
    onSuccess: () => {
      setError(null);
      refresh();
      onDone?.();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const needsOmChoice = !access.officeManager && omCount(staff) > 1;
  const button = (circuit: LeadCircuit) => (
    <Button
      size="sm"
      variant={suggested === circuit ? 'primary' : 'outline'}
      disabled={dispatch.isPending || (circuit === 'OFFICE_MANAGER' && needsOmChoice && !om)}
      onClick={() => dispatch.mutate(circuit)}
      title={suggested === circuit ? 'Circuit suggéré d’après le canal' : undefined}
    >
      {circuit === 'SALES_TEAM' ? <Users className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
      {circuit === 'SALES_TEAM' ? (agent ? 'Circuit 1 et attribuer' : 'Circuit 1 · Sales Team') : access.officeManager && !om ? 'Circuit 2 · je le prends' : 'Circuit 2 · Office Manager'}
    </Button>
  );

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <div className="flex flex-wrap items-center gap-2">
        {canAttribute && (
          <Select aria-label="Commercial à qui l’attribuer" className="h-9 w-auto min-w-44" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">Sans attribuer</option>
            <SalesAgentOptions staff={staff} />
          </Select>
        )}
        {button('SALES_TEAM')}
        {needsOmChoice && (
          <Select aria-label="Office Manager" className="h-9 w-auto min-w-40" value={om} onChange={(e) => setOm(e.target.value)}>
            <option value="">Choisir l’Office Manager</option>
            <OfficeManagerOptions staff={staff} />
          </Select>
        )}
        {button('OFFICE_MANAGER')}
      </div>
      {error && (
        <p className="text-xs text-brand-orange" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Relance (avant la visite) : au-delà des relances sans réponse fixées dans les paramètres, retour au responsable. */
export function FollowUpModal({ leadId, open, onClose }: { leadId: string; open: boolean; onClose: () => void }) {
  const refresh = useLeadRefresh(leadId);
  const [form, setForm] = useState({ type: 'CALL' as 'CALL' | 'EMAIL' | 'MEETING', content: '', answered: false, nextActionAt: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/crm/leads/${leadId}/follow-up`, {
        type: form.type,
        content: form.content,
        answered: form.answered,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrer une relance"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || !form.content.trim()} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Moyen de relance">
          {(['CALL', 'EMAIL', 'MEETING'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={form.type === t} onClick={() => set({ type: t })} className={cn('rounded-pill px-3 py-1 text-xs font-semibold', form.type === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
              {t === 'CALL' ? 'Appel' : t === 'EMAIL' ? 'E-mail' : 'Message / rencontre'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Le client a-t-il répondu ?">
          {[
            { value: true, label: 'Le client a répondu' },
            { value: false, label: 'Sans réponse' },
          ].map((o) => (
            <button key={String(o.value)} type="button" aria-pressed={form.answered === o.value} onClick={() => set({ answered: o.value })} className={cn('h-11 rounded-xl border text-sm font-semibold', form.answered === o.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/10 text-ink-600 hover:bg-ink-900/5')}>
              {o.label}
            </button>
          ))}
        </div>
        <Field label="Compte rendu" htmlFor="fu-content">
          <Textarea id="fu-content" rows={3} value={form.content} onChange={(e) => set({ content: e.target.value })} placeholder="Ce qui a été dit, ce qui bloque, ce qui est convenu" autoFocus />
        </Field>
        <Field label="Prochaine relance" htmlFor="fu-next">
          <Input id="fu-next" type="datetime-local" value={form.nextActionAt} onChange={(e) => set({ nextActionAt: e.target.value })} />
          <p className="mt-1 text-xs text-ink-500">Laissez vide pour la date par défaut fixée dans les paramètres. Vous serez alerté à l’échéance.</p>
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

/** Visite, visio ou journée d'essai acceptée par le client. En circuit 1, le dossier passe à l'Office Manager. */
export function VisitModal({ leadId, circuit, open, onClose }: { leadId: string; circuit: LeadCircuit | null; open: boolean; onClose: () => void }) {
  const refresh = useLeadRefresh(leadId);
  const access = useCrmAccess();
  const { data: staff } = useStaff();
  // Initialiseur paresseux : la date par défaut (demain) n'est calculée qu'une fois.
  const [form, setForm] = useState(() => ({ type: 'VISIT' as 'VISIT' | 'VIDEO' | 'TRIAL_DAY', startAt: toInputDateTime(new Date(Date.now() + 24 * 3600 * 1000)), location: '', notes: '', officeManagerId: '' }));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const handover = circuit === 'SALES_TEAM';
  const chooseOm = handover && !access.officeManager && omCount(staff) > 1;

  const save = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/crm/leads/${leadId}/visit`, {
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        location: form.location,
        notes: form.notes,
        officeManagerId: form.officeManagerId || null,
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Visite ou visio confirmée"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || !form.startAt || (chooseOm && !form.officeManagerId)} onClick={() => save.mutate()}>
            {handover ? 'Confirmer et transmettre' : 'Confirmer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Type de rendez-vous">
          {(['VISIT', 'VIDEO', 'TRIAL_DAY'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={form.type === t} onClick={() => set({ type: t })} className={cn('h-11 rounded-xl border text-sm font-semibold', form.type === t ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/10 text-ink-600 hover:bg-ink-900/5')}>
              {APPOINTMENT_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date et heure" htmlFor="v-start">
            <Input id="v-start" type="datetime-local" value={form.startAt} onChange={(e) => set({ startAt: e.target.value })} />
          </Field>
          <Field label={form.type === 'VIDEO' ? 'Lien de la visio' : 'Lieu'} htmlFor="v-location">
            <Input id="v-location" value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder={form.type === 'VIDEO' ? 'https://meet…' : 'IN NETWORK Hydra'} />
          </Field>
          {chooseOm && (
            <Field label="Office Manager qui reçoit le dossier" htmlFor="v-om" className="sm:col-span-2">
              <Select id="v-om" value={form.officeManagerId} onChange={(e) => set({ officeManagerId: e.target.value })}>
                <option value="">Choisir…</option>
                <OfficeManagerOptions staff={staff} />
              </Select>
            </Field>
          )}
          <Field label="À l’attention de l’Office Manager" htmlFor="v-notes" className="sm:col-span-2">
            <Textarea id="v-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ce qu’il faut savoir pour l’accueil" />
          </Field>
        </div>
        <p className="rounded-xl bg-ink-900/[0.04] px-4 py-3 text-xs text-ink-600">
          {handover
            ? 'Le dossier (fiche, besoin, offre pressentie) passe à l’Office Manager, qui organise la visite et suit la procédure d’accueil. Vous restez le closer et suivez le dossier en lecture jusqu’au paiement.'
            : form.type === 'TRIAL_DAY'
              ? 'Une fois la journée d’essai marquée effectuée, un suivi est programmé automatiquement à J+3.'
              : 'Le rendez-vous rejoint votre agenda.'}
        </p>
        {error && (
          <p className="text-sm text-brand-orange" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Passerelle : changer de circuit, avec un motif consigné sur la fiche. */
export function CircuitModal({ leadId, circuit, open, onClose }: { leadId: string; circuit: LeadCircuit; open: boolean; onClose: () => void }) {
  const refresh = useLeadRefresh(leadId);
  const { data: staff } = useStaff();
  const access = useCrmAccess();
  const target: LeadCircuit = circuit === 'SALES_TEAM' ? 'OFFICE_MANAGER' : 'SALES_TEAM';
  const [reason, setReason] = useState('');
  const [om, setOm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chooseOm = target === 'OFFICE_MANAGER' && !access.officeManager && omCount(staff) > 1;

  const save = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${leadId}/circuit`, { circuit: target, reason, officeManagerId: om || null }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target === 'SALES_TEAM' ? 'Confier à la Sales Team' : 'Renvoyer à l’Office Manager'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || reason.trim().length < 5 || (chooseOm && !om)} onClick={() => save.mutate()}>
            Passer en {CIRCUIT[target].short.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          {target === 'SALES_TEAM'
            ? 'Le lead demande un travail de qualification : il part chez le responsable commercial, qui l’attribuera.'
            : 'Le lead est prêt à être traité : il passe en circuit 2. Le commercial n’en sera plus le closer.'}
        </p>
        {chooseOm && (
          <Field label="Office Manager" htmlFor="c-om">
            <Select id="c-om" value={om} onChange={(e) => setOm(e.target.value)}>
              <option value="">Choisir…</option>
              <OfficeManagerOptions staff={staff} />
            </Select>
          </Field>
        )}
        <Field label="Motif (consigné sur la fiche)" htmlFor="c-reason">
          <Textarea id="c-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
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

/** Clôture d'un lead (perdu, sans suite) avec son motif. */
export function LoseModal({ leadId, open, onClose }: { leadId: string; open: boolean; onClose: () => void }) {
  const refresh = useLeadRefresh(leadId);
  // Motifs suggérés, réglés par le super administrateur (Paramètres).
  const suggestions = usePlatformOptions().data?.lists.lostReasons ?? [];
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${leadId}/lose`, { reason }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clôturer le lead"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending || reason.trim().length < 2} onClick={() => save.mutate()}>
            Clôturer
          </Button>
        </>
      }
    >
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setReason(s)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', reason === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 text-ink-700 hover:bg-ink-900/5')}>
              {s}
            </button>
          ))}
        </div>
      )}
      <Field label="Motif" htmlFor="lost-reason">
        <Textarea id="lost-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Prix, concurrent, injoignable, hors périmètre, doublon…" autoFocus />
      </Field>
      {error && (
        <p className="mt-3 text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
