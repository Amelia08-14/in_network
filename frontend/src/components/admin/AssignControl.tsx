'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AssigneeOptions, errorMessage, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

/**
 * Assignation d'un lead validé à un commercial (responsable commercial). `workload`
 * affiche la charge de chaque commercial (leads en cours) pour répartir équitablement.
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
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
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
          <option value="">{allowClear ? 'Retirer le commercial (retour à assigner)' : 'Choisir un commercial…'}</option>
          <AssigneeOptions staff={decorated} />
        </Select>
        <Button size="sm" disabled={assign.isPending || (!choice && !allowClear) || choice === (current ?? '')} onClick={() => assign.mutate()}>
          <UserCheck className="h-4 w-4" /> {assign.isPending ? 'Assignation…' : current ? 'Réassigner' : 'Assigner'}
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
