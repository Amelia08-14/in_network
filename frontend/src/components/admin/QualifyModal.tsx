'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Snowflake, Sun } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AssigneeOptions, errorMessage, Field, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { PRIORITY, SOURCE_LABEL, TONE_CLASS } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { LeadListItem, LeadPriority } from '@/types/crm';

const PRIORITY_ICON = { COLD: Snowflake, WARM: Sun, HOT: Flame } as const;

/** Ce qu'il faut pour qualifier un lead : la liste ou la fiche fournissent ces champs. */
export type QualifiableLead = Pick<LeadListItem, 'id' | 'reference' | 'title' | 'contactName' | 'companyName' | 'source' | 'assignedToId'> & {
  notes?: string | null;
  user?: { profile: { isPublic: boolean } | null } | null;
};

// Qualification d'un lead entrant par le responsable commercial : besoin, budget,
// décideur, délai, température. Deux issues : le valider (il passe « À assigner », ou
// « Assigné » si un commercial est choisi) ou l'écarter avec un motif.
export function QualifyModal({ lead, onClose, onDone }: { lead: QualifiableLead | null; onClose: () => void; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const [form, setForm] = useState({ priority: 'WARM' as LeadPriority, need: '', budget: '', decisionMaker: '', timeline: '', notes: '', assignee: '', validateAccount: true });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm-lead'] });
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    onDone?.();
    onClose();
  };

  const qualify = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/crm/leads/${lead!.id}/qualify`, {
        priority: form.priority,
        need: form.need,
        budget: form.budget,
        decisionMaker: form.decisionMaker,
        timeline: form.timeline,
        notes: form.notes,
        ...(form.assignee ? { assignedToId: form.assignee } : {}),
        ...(pendingAccount ? { validateAccount: form.validateAccount } : {}),
      }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${lead!.id}/reject`, { reason }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  const busy = qualify.isPending || reject.isPending;
  // Lead d'un membre dont le compte attend sa validation : on propose de le valider dans le même geste.
  const pendingAccount = Boolean(lead?.user && !lead.user.profile?.isPublic);

  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      title={lead ? `Qualifier ${lead.reference}` : 'Qualifier'}
      size="lg"
      footer={
        rejecting ? (
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Retour
            </Button>
            <Button variant="outline" disabled={busy || reason.trim().length < 2} onClick={() => reject.mutate()}>
              Écarter ce lead
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setRejecting(true)}>
              Écarter…
            </Button>
            <Button disabled={busy} onClick={() => qualify.mutate()}>
              {qualify.isPending ? 'Validation…' : form.assignee ? 'Valider et assigner' : 'Valider le lead'}
            </Button>
          </>
        )
      }
    >
      {lead && (
        <div className="space-y-5">
          <div className="rounded-xl bg-ink-900/[0.04] px-4 py-3 text-sm">
            <p className="font-semibold text-ink-900">{lead.title}</p>
            <p className="mt-0.5 text-ink-600">
              {lead.contactName}
              {lead.companyName ? ` · ${lead.companyName}` : ''} · {SOURCE_LABEL[lead.source]}
            </p>
            {lead.notes && <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-ink-500">{lead.notes}</p>}
          </div>

          {rejecting ? (
            <Field label="Motif — ce lead ne sera pas poursuivi" htmlFor="q-reason">
              <Textarea id="q-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hors périmètre, doublon, contact injoignable, demande non sérieuse…" autoFocus />
            </Field>
          ) : (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink-800">Température du lead</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRIORITY) as LeadPriority[]).map((p) => {
                    const Icon = PRIORITY_ICON[p];
                    const on = form.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ priority: p })}
                        className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors', on ? cn(TONE_CLASS[PRIORITY[p].tone], 'border-current') : 'border-ink-900/10 text-ink-600 hover:bg-ink-900/5')}
                      >
                        <Icon className="h-4 w-4" /> {PRIORITY[p].label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Besoin identifié" htmlFor="q-need" className="sm:col-span-2">
                  <Textarea id="q-need" rows={2} value={form.need} onChange={(e) => set({ need: e.target.value })} placeholder="Que cherche le client ? Quel service ?" />
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
                <Field label="Assigner à" htmlFor="q-assignee">
                  <Select id="q-assignee" value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
                    <option value="">{lead.assignedToId ? 'Garder le commercial actuel' : 'Valider sans assigner (à assigner ensuite)'}</option>
                    <AssigneeOptions staff={staff} />
                  </Select>
                </Field>
                {pendingAccount && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-green-700/25 bg-accent-green/10 px-4 py-3 text-sm sm:col-span-2">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#73B866]" checked={form.validateAccount} onChange={(e) => set({ validateAccount: e.target.checked })} />
                    <span>
                      <strong className="text-ink-900">Valider aussi le compte membre</strong>
                      <span className="block text-xs text-ink-600">Son espace est déverrouillé et le client est prévenu. Qualifier une inscription et valider le compte sont un seul geste : le lead passe ensuite chez un commercial.</span>
                    </span>
                  </label>
                )}
                <Field label="Notes de qualification" htmlFor="q-notes" className="sm:col-span-2">
                  <Textarea id="q-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                </Field>
              </div>
            </>
          )}

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
