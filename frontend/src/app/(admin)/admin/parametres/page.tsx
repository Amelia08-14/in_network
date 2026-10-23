'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { errorMessage, ErrorNote, PageTitle, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';

// Paramètres du processus commercial v1.3 : les délais et seuils que la
// Direction règle sans développement. Une valeur vide (« non fixée ») désactive
// la règle correspondante (protection des leads, seuil de validation).

type SettingValue = number | boolean | number[] | null;
interface Setting {
  key: string;
  label: string;
  value: SettingValue;
  defaultValue: SettingValue;
}

const HINTS: Record<string, string> = {
  followUpMaxAttempts: 'Au-delà, le lead revient au responsable commercial (circuit 1) ou attend la décision de l’Office Manager (circuit 2).',
  followUpIntervalDays: 'Date proposée pour la relance suivante.',
  trialFollowUpDays: 'Un appel de suivi est programmé après une journée d’essai.',
  checkInDays: 'Appels programmés dans l’agenda du référent après l’activation (ex. 7, 30).',
  expiryAlertDays: 'Le membre et son référent sont prévenus avant l’échéance (ex. 60, 30, 7).',
  expiryGraceDays: 'Délai avant de passer un service « Expiré » après son échéance.',
  leadProtectionDays: 'À fixer par IN NETWORK. Vide : pas de règle.',
  quoteDirectionThreshold: 'À fixer par IN NETWORK. Vide : pas de seuil.',
  directionApprovesOfficeManagerQuotes: 'Sinon, le responsable commercial valide aussi les devis sur mesure du circuit 2.',
};

const toText = (value: SettingValue) => (Array.isArray(value) ? value.join(', ') : value === null ? '' : String(value));

export default function SettingsPage() {
  const access = useCrmAccess();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['process-settings'],
    queryFn: () => api.get<{ data: Setting[] }>('/api/admin/settings').then((r) => r.data),
    enabled: access.direction,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, SettingValue> = {};
      for (const setting of settings ?? []) {
        if (!(setting.key in draft)) continue;
        const raw = draft[setting.key];
        if (typeof setting.defaultValue === 'boolean') body[setting.key] = Boolean(raw);
        else if (Array.isArray(setting.defaultValue)) body[setting.key] = String(raw).split(/[,;\s]+/).filter(Boolean).map(Number);
        else body[setting.key] = String(raw).trim() === '' ? null : Number(raw);
      }
      return api.patch('/api/admin/settings', body);
    },
    onSuccess: () => {
      setDraft({});
      setError(null);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['process-settings'] });
    },
    onError: (e) => {
      setSaved(false);
      setError(errorMessage(e, 'Une valeur est invalide.'));
    },
  });

  if (!access.direction) return <EmptyState title="Réservé à la Direction" />;

  return (
    <div className="space-y-6">
      <PageTitle hue="gray" title="Paramètres du processus" description="Délais, alertes et seuils du processus commercial. Ils s’appliquent dès l’enregistrement, aux automatisations comme aux écrans." />
      {isLoading || !settings ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-ink-900/8">
            {settings.map((s) => {
              const current = s.key in draft ? draft[s.key] : typeof s.value === 'boolean' ? s.value : toText(s.value);
              return (
                <div key={s.key} className="grid gap-2 py-4 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div>
                    <label htmlFor={`s-${s.key}`} className="text-sm font-medium text-ink-900">
                      {s.label}
                    </label>
                    <p className="text-xs text-ink-500">
                      {HINTS[s.key]} Par défaut : {typeof s.defaultValue === 'boolean' ? (s.defaultValue ? 'oui' : 'non') : toText(s.defaultValue) || 'non fixé'}.
                    </p>
                  </div>
                  {typeof s.defaultValue === 'boolean' ? (
                    <input id={`s-${s.key}`} type="checkbox" className="h-5 w-5 justify-self-start sm:justify-self-end" checked={Boolean(current)} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
                  ) : (
                    <Input id={`s-${s.key}`} value={String(current)} placeholder="Non fixé" onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <ErrorNote message={error} />
      {saved && <p className="text-sm text-green-700">Paramètres enregistrés.</p>}
      <div className="flex justify-end">
        <Button disabled={save.isPending || Object.keys(draft).length === 0} onClick={() => save.mutate()}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
