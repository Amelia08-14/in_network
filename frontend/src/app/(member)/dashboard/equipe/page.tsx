'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  KeyRound,
  Loader2,
  Mail,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberImageUploader } from '@/components/features/upload/MemberImageUploader';
import { api, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { CompanyDashboard } from '@/types';

function errText(e: unknown) {
  return e instanceof ApiRequestError ? e.message : 'Une erreur est survenue.';
}

export default function TeamDashboardPage() {
  const router = useRouter();
  const { user, status, hydrate } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  // Réservé au représentant qui a inscrit l'entreprise.
  useEffect(() => {
    if (status === 'authenticated' && !user?.company?.isOwner) router.replace('/dashboard');
  }, [status, user, router]);

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company'],
    queryFn: () => api.get<{ data: CompanyDashboard }>('/api/companies/mine').then((r) => r.data),
    enabled: status === 'authenticated' && Boolean(user?.company?.isOwner),
  });

  if (isLoading || !company) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Mon équipe</h1>
        <p className="mt-1 text-sm text-ink-500">
          Gérez les postes de <span className="font-medium text-ink-700">{company.name}</span> et les accès de
          vos collaborateurs.
        </p>
      </div>

      {!company.isActive && (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-4 text-sm text-ink-700">
          Ce compte entreprise est actuellement désactivé. Contactez IN NETWORK pour le réactiver.
        </div>
      )}

      <SeatOverview company={company} />
      <CompanyIdentityCard company={company} />
      <InviteCard company={company} />
      <MembersCard company={company} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SeatOverview({ company }: { company: CompanyDashboard }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(company.seatLimit);
  const [msg, setMsg] = useState<string | null>(null);

  const free = company.seatLimit - company.usedSeats;

  const save = useMutation({
    mutationFn: (seatLimit: number) => api.patch('/api/companies/mine', { seatLimit }),
    onSuccess: () => {
      setMsg(null);
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
    onError: (e) => setMsg(errText(e)),
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Postes</p>
            <p className="mt-1 font-heading text-3xl font-bold text-ink-900">
              {company.usedSeats}
              <span className="text-ink-400"> / {company.seatLimit}</span>
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {free > 0 ? `${free} poste${free > 1 ? 's' : ''} disponible${free > 1 ? 's' : ''}` : 'Tous les postes sont attribués'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Retirer un poste"
              className="text-ink-400 hover:text-ink-700 disabled:opacity-30"
              disabled={target <= company.usedSeats}
              onClick={() => setTarget((n) => Math.max(company.usedSeats, n - 1))}
            >
              <MinusCircle className="h-7 w-7" />
            </button>
            <Input
              type="number"
              min={company.usedSeats}
              max={200}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="h-11 w-20 text-center text-base font-semibold"
            />
            <button
              type="button"
              aria-label="Ajouter un poste"
              className="text-ink-400 hover:text-ink-700"
              onClick={() => setTarget((n) => Math.min(200, n + 1))}
            >
              <PlusCircle className="h-7 w-7" />
            </button>
            <Button
              variant="primary"
              size="sm"
              disabled={target === company.seatLimit || save.isPending}
              onClick={() => save.mutate(target)}
            >
              {save.isPending ? 'Enregistrement…' : 'Mettre à jour'}
            </Button>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-ink-900/8">
          <div
            className="h-full rounded-full bg-brand-orange transition-all"
            style={{ width: `${Math.min(100, (company.usedSeats / Math.max(1, company.seatLimit)) * 100)}%` }}
          />
        </div>

        {msg && <p className="text-sm text-brand-orange">{msg}</p>}
        <p className="text-xs text-ink-500">
          Le nombre de postes ne peut pas être inférieur au nombre de collaborateurs rattachés. Retirez d&apos;abord
          un collaborateur pour libérer un poste.
        </p>
      </CardContent>
    </Card>
  );
}

function CompanyIdentityCard({ company }: { company: CompanyDashboard }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: company.name,
    sector: company.sector ?? '',
    website: company.website ?? '',
    logoUrl: company.logoUrl,
  });
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/api/companies/mine', {
        name: form.name.trim(),
        sector: form.sector.trim() || null,
        website: form.website.trim() || undefined,
        logoUrl: form.logoUrl ?? undefined,
      }),
    onSuccess: () => {
      setMsg({ text: 'Enregistré.', kind: 'ok' });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      useAuthStore.getState().hydrate();
    },
    onError: (e) => setMsg({ text: errText(e), kind: 'err' }),
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-ink-700">
          <Building2 className="h-4 w-4" />
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide">Identité de l&apos;entreprise</h2>
        </div>

        <MemberImageUploader
          label="Logo de l'entreprise"
          value={form.logoUrl}
          onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Raison sociale</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Secteur</Label>
            <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Site web</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {msg && (
            <span className={msg.kind === 'ok' ? 'text-sm text-accent-green' : 'text-sm text-brand-orange'}>
              {msg.text}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500">
          Le logo et la raison sociale sont repris sur le profil annuaire de chaque collaborateur.
        </p>
      </CardContent>
    </Card>
  );
}

function InviteCard({ company }: { company: CompanyDashboard }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', jobTitle: '' });
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const full = company.usedSeats >= company.seatLimit;

  const invite = useMutation({
    mutationFn: () =>
      api.post('/api/companies/mine/members', {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        jobTitle: form.jobTitle.trim() || undefined,
      }),
    onSuccess: () => {
      setMsg({ text: 'Invitation envoyée — le collaborateur reçoit ses accès par email.', kind: 'ok' });
      setForm({ email: '', firstName: '', lastName: '', jobTitle: '' });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
    onError: (e) => setMsg({ text: errText(e), kind: 'err' }),
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-ink-700">
          <UserPlus className="h-4 w-4" />
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide">Inviter un collaborateur</h2>
        </div>

        {full ? (
          <div className="rounded-xl border border-ink-900/10 bg-ink-900/[0.03] p-4 text-sm text-ink-600">
            Tous vos postes sont attribués. Augmentez le nombre de postes ci-dessus pour inviter un nouveau
            collaborateur.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Prénom</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Fonction (optionnel)</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={invite.isPending || !form.email.trim() || !form.firstName.trim() || !form.lastName.trim()}
              onClick={() => invite.mutate()}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              {invite.isPending ? 'Envoi…' : 'Envoyer l\'invitation'}
            </Button>
          </>
        )}

        {msg && (
          <p className={msg.kind === 'ok' ? 'text-sm text-accent-green' : 'text-sm text-brand-orange'}>{msg.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MembersCard({ company }: { company: CompanyDashboard }) {
  const sorted = useMemo(
    () => [...company.members].sort((a, b) => Number(b.isOwner) - Number(a.isOwner)),
    [company.members],
  );

  return (
    <Card>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <EmptyState title="Aucun collaborateur" />
        ) : (
          <div className="divide-y divide-ink-900/8">
            {sorted.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({ member }: { member: CompanyDashboard['members'][number] }) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-company'] });

  const resend = useMutation({
    mutationFn: () => api.post(`/api/companies/mine/members/${member.id}/resend`),
    onSuccess: () => setMsg('Nouveaux accès envoyés par email.'),
    onError: (e) => setMsg(errText(e)),
  });
  const setActive = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/api/companies/mine/members/${member.id}`, { isActive }),
    onSuccess: invalidate,
    onError: (e) => setMsg(errText(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/companies/mine/members/${member.id}`),
    onSuccess: invalidate,
    onError: (e) => setMsg(errText(e)),
  });

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-ink-800">
            {name}
            {member.isOwner && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Responsable
              </span>
            )}
          </p>
          <p className="truncate text-sm text-ink-500">
            {member.email}
            {member.jobTitle ? ` · ${member.jobTitle}` : ''}
          </p>
        </div>

        <Badge variant={member.isActive ? 'success' : 'neutral'}>
          {member.isActive ? 'Actif' : 'Désactivé'}
        </Badge>
        {member.isActive && (
          <Badge variant={member.isPublic ? 'entreprise' : 'neutral'}>
            {member.isPublic ? "Publié à l'annuaire" : 'Annuaire en attente'}
          </Badge>
        )}

        {!member.isOwner && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
              title="Renvoyer les accès par email"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={setActive.isPending}
              onClick={() => setActive.mutate(!member.isActive)}
            >
              {member.isActive ? 'Désactiver' : 'Réactiver'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Retirer ${name} de l'équipe ? Son poste sera libéré.`)) remove.mutate();
              }}
              title="Retirer de l'équipe"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-ink-500">{msg}</p>}
    </div>
  );
}
