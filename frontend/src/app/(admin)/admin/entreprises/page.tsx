'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, KeyRound, Users2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { CompanySeats } from '@/components/features/CompanySeats';
import { cn } from '@/lib/utils';
import type { AdminCompany, CompanyMember } from '@/types';

function errText(e: unknown) {
  return e instanceof ApiRequestError ? e.message : 'Une erreur est survenue.';
}

export default function AdminCompaniesPage() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.get<{ data: AdminCompany[] }>('/api/admin/companies').then((r) => r.data),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Entreprises</h1>
        <p className="mt-1 text-sm text-ink-500">
          Comptes entreprise multi-postes. Chaque poste est occupé par un collaborateur qui a son propre accès :
          dépliez une entreprise pour voir ses membres et leurs accès, renvoyer des identifiants ou couper un accès.
          Le représentant invite ses collaborateurs depuis son espace.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement…</p>
          ) : !companies || companies.length === 0 ? (
            <EmptyState title="Aucune entreprise inscrite" />
          ) : (
            <div className="divide-y divide-ink-900/8">
              {companies.map((c) => (
                <CompanyRow key={c.id} company={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyRow({ company }: { company: AdminCompany }) {
  const queryClient = useQueryClient();
  const [seatLimit, setSeatLimit] = useState(company.seatLimit);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-companies'] });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/companies/${company.id}`, body),
    onSuccess: () => {
      setMsg('Enregistré.');
      invalidate();
    },
    onError: (e) => setMsg(errText(e)),
  });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-800">{company.name}</p>
          <p className="truncate text-sm text-ink-500">
            {company.ownerName ? `${company.ownerName} · ` : ''}
            {company.ownerEmail}
            {company.sector ? ` · ${company.sector}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-700 hover:bg-ink-900/5"
        >
          <Users2 className="h-4 w-4" />
          {company.usedSeats} / {company.seatLimit} postes
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
        {!company.validated && <Badge variant="neutral">Représentant non validé</Badge>}
        <Badge variant={company.isActive ? 'success' : 'neutral'}>
          {company.isActive ? 'Actif' : 'Suspendu'}
        </Badge>
      </div>

      {open && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink-900/8">
          <CompanySeats members={company.members} seatLimit={company.seatLimit} actions={(m) => <SeatAccessActions companyId={company.id} member={m} />} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-600">
          Postes
          <Input
            type="number"
            min={company.usedSeats}
            max={500}
            value={seatLimit}
            onChange={(e) => setSeatLimit(Number(e.target.value))}
            className="h-9 w-20 text-center"
          />
        </label>
        <Button
          size="sm"
          variant="primary"
          disabled={update.isPending || seatLimit === company.seatLimit}
          onClick={() => update.mutate({ seatLimit })}
        >
          Mettre à jour
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ isActive: !company.isActive })}
        >
          {company.isActive ? 'Suspendre' : 'Réactiver'}
        </Button>
        {msg && <span className="text-xs text-ink-500">{msg}</span>}
      </div>
    </div>
  );
}

function SeatAccessActions({ companyId, member }: { companyId: string; member: CompanyMember }) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const resend = useMutation({
    mutationFn: () => api.post(`/api/admin/companies/${companyId}/members/${member.id}/resend`),
    onSuccess: () => setMsg('Identifiants envoyés par e-mail.'),
    onError: (e) => setMsg(errText(e)),
  });
  const setActive = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/api/admin/companies/${companyId}/members/${member.id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-companies'] }),
    onError: (e) => setMsg(errText(e)),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={resend.isPending}
          onClick={() => window.confirm(`Envoyer un nouveau mot de passe à ${member.email} ? L’ancien ne fonctionnera plus.`) && resend.mutate()}
          title="Renvoyer les identifiants"
        >
          <KeyRound className="h-4 w-4" /> Renvoyer
        </Button>
        <Button size="sm" variant="outline" disabled={setActive.isPending} onClick={() => setActive.mutate(!member.isActive)}>
          {member.isActive ? 'Couper l’accès' : 'Rouvrir l’accès'}
        </Button>
      </div>
      {msg && <p className="text-xs text-ink-500">{msg}</p>}
    </div>
  );
}
