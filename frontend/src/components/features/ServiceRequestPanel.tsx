'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiRequestError } from '@/lib/admin-api';

export type ServiceRequestStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface AdminServiceRequest {
  id: string;
  status: ServiceRequestStatus;
  notes: string | null;
  adminDetails: string | null;
  quotedAmount: string | null;
  quotedCurrency: string;
  confirmedAt: string | null;
  createdAt: string;
  targetType: 'SERVICE' | 'SPACE' | 'PLAN';
  service: { title: string } | null;
  space: { name: string } | null;
  plan: { name: string } | null;
  user: { email: string; profile: { firstName: string; lastName: string } | null } | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCompany: string | null;
}

const STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  NEW: 'Nouvelle',
  IN_PROGRESS: 'Prise en charge',
  DONE: 'Terminée',
  CANCELLED: 'Annulée',
};
const STATUS_VARIANT: Record<ServiceRequestStatus, 'neutral' | 'startup' | 'success'> = {
  NEW: 'startup',
  IN_PROGRESS: 'neutral',
  DONE: 'success',
  CANCELLED: 'neutral',
};

export function targetLabel(req: Pick<AdminServiceRequest, 'service' | 'space' | 'plan'>) {
  return req.service?.title ?? req.space?.name ?? req.plan?.name ?? 'Demande';
}

export function requesterLabel(req: AdminServiceRequest) {
  if (req.user) {
    return req.user.profile ? `${req.user.profile.firstName} ${req.user.profile.lastName}` : req.user.email;
  }
  return req.guestName ?? 'Visiteur';
}

function recipientEmail(req: AdminServiceRequest) {
  return req.user?.email ?? req.guestEmail ?? null;
}

export function ServiceRequestPanel({
  request,
  onClose,
  onChanged,
}: {
  request: AdminServiceRequest | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  // Le parent monte ce composant avec key={request.id} : l'état est donc
  // initialisé une fois depuis la demande, pas resynchronisé via un effet.
  const queryClient = useQueryClient();
  const [quotedAmount, setQuotedAmount] = useState(request?.quotedAmount ?? '');
  const [quotedCurrency, setQuotedCurrency] = useState(request?.quotedCurrency || 'DZD');
  const [adminDetails, setAdminDetails] = useState(request?.adminDetails ?? '');
  const [status, setStatus] = useState<ServiceRequestStatus>(request?.status ?? 'NEW');
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] });
    queryClient.invalidateQueries({ queryKey: ['admin-validations'] });
    onChanged();
  };

  const errorText = (e: unknown) =>
    e instanceof ApiRequestError ? e.message : 'Connexion au serveur impossible. Réessayez.';

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/service-requests/${request!.id}`, {
        quotedAmount: quotedAmount.trim() === '' ? null : Number(quotedAmount),
        quotedCurrency: quotedCurrency.trim() || 'DZD',
        adminDetails: adminDetails.trim() === '' ? null : adminDetails.trim(),
        status,
      }),
    onSuccess: () => {
      setMessage({ text: 'Modifications enregistrées (aucun email envoyé).', kind: 'success' });
      invalidate();
    },
    onError: (e) => setMessage({ text: errorText(e), kind: 'error' }),
  });

  const confirm = useMutation({
    mutationFn: () => api.post(`/api/admin/service-requests/${request!.id}/confirm`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setMessage({ text: errorText(e), kind: 'error' }),
  });

  if (!request) return null;

  const email = recipientEmail(request);
  const alreadyConfirmed = Boolean(request.confirmedAt);
  const contactLine = [email, request.guestPhone, request.guestCompany].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/35 backdrop-blur-xs" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-ink-900">Demande de service</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-2xl bg-ink-900 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold">{targetLabel(request)}</p>
                <p className="mt-1 text-sm text-white/65">{requesterLabel(request)}</p>
                {contactLine && <p className="mt-0.5 text-xs text-white/50">{contactLine}</p>}
              </div>
              <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
            </div>
          </div>

          {request.notes && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Message du demandeur</h3>
              <p className="mt-2 whitespace-pre-line rounded-2xl border border-ink-900/8 p-4 text-sm leading-relaxed text-ink-600">
                {request.notes}
              </p>
            </section>
          )}

          {alreadyConfirmed && (
            <p className="flex items-center gap-2 rounded-2xl bg-accent-green/15 p-3 text-sm font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Confirmée le {new Date(request.confirmedAt as string).toLocaleDateString('fr-FR')} — email envoyé au
              demandeur.
            </p>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              Devis &amp; détails {alreadyConfirmed ? '' : '— à ajuster avant validation'}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="sr-amount">Prix</Label>
                <Input
                  id="sr-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Ex. 25000"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sr-currency">Devise</Label>
                <Input
                  id="sr-currency"
                  value={quotedCurrency}
                  onChange={(e) => setQuotedCurrency(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sr-details">Détails / ajustements (repris dans l&apos;email)</Label>
              <Textarea
                id="sr-details"
                rows={4}
                value={adminDetails}
                onChange={(e) => setAdminDetails(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="sr-status">Statut</Label>
              <Select id="sr-status" value={status} onChange={(e) => setStatus(e.target.value as ServiceRequestStatus)}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {message && (
              <p
                className={
                  message.kind === 'success'
                    ? 'flex items-center gap-1.5 text-sm text-accent-green'
                    : 'text-sm text-brand-orange'
                }
              >
                {message.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {message.text}
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-3 border-t border-ink-900/8 pt-5">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button
              variant="primary"
              disabled={confirm.isPending || save.isPending || !email || alreadyConfirmed}
              onClick={() => {
                if (
                  window.confirm(
                    `Valider cette demande et envoyer l'email de confirmation à ${email} ?\nPensez à enregistrer vos modifications d'abord.`,
                  )
                ) {
                  confirm.mutate();
                }
              }}
            >
              {confirm.isPending ? 'Envoi...' : 'Valider et envoyer la confirmation'}
            </Button>
          </div>
          {!email && (
            <p className="text-xs text-brand-orange">
              Aucune adresse email rattachée à cette demande — la confirmation ne peut pas être envoyée.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
