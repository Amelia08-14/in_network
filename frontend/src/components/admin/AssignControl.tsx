'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { errorMessage, SalesAgentOptions, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

/**
 * Attribution d'un lead du circuit 1 à un commercial (responsable commercial) :
 * sédentaire pour le digital, l'entrant, la diaspora et les offres simples,
 * terrain pour les entreprises et les rendez-vous physiques. `workload`
 * affiche la charge de chaque commercial pour répartir équitablement.
 */
export function AssignControl({
  leadId,
  current,
  allowClear = false,
  workload,
  className,
  onDone,
}: {
  leadId: string;
  current: string | null;
  allowClear?: boolean;
  workload?: Map<string, number>;
  className?: string;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const [choice, setChoice] = useState(current ?? '');
  const [error, setError] = useState<string | null>(null);

  const assign = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${leadId}/assign`, { assignedToId: choice || null }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-home'] });
      onDone?.();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  // Charge de travail affichée à côté du nom (« Samira B. — 3 en cours »).
  const decorated = (staff ?? []).map((u) => (workload ? { ...u, displayName: `${u.displayName || u.email} — ${workload.get(u.id) ?? 0} en cours` } : u));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Commercial" className="h-9 min-w-52 flex-1" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">{allowClear ? 'Retirer le commercial (retour à attribuer)' : 'Choisir un commercial…'}</option>
          <SalesAgentOptions staff={decorated} />
        </Select>
        <Button size="sm" disabled={assign.isPending || (!choice && !allowClear) || choice === (current ?? '')} onClick={() => assign.mutate()}>
          <UserCheck className="h-4 w-4" /> {assign.isPending ? 'Attribution…' : current ? 'Réattribuer' : 'Attribuer'}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-brand-orange" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
