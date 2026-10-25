'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarCheck, CalendarDays, CheckCircle2, Clock, Gift, Loader2, Mail, PackageCheck, Phone, ReceiptText, RefreshCw, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { dateFr } from '@/lib/crm';
import { HUE, type Hue } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import type { MemberServiceStatus } from '@/types/crm';

// Accueil de l'espace membre (processus v1.3) : ce qui attend une action du
// membre, ses services et leurs échéances, son référent, les prochains
// événements et la fidélité (ancienneté, recommandations de contacts).

interface Overview {
  validated: boolean;
  firstName: string | null;
  memberSince: string | null;
  referent: { name: string; email: string; phone: string | null } | null;
  actions: { quotesToConfirm: number; proformasToPay: number; servicesToValidate: number; servicesToRenew: number };
  requestsInPricing: number;
  services: {
    active: number;
    activating: number;
    total: number;
    nextExpiries: { id: string; title: string; expiresAt: string; daysLeft: number; status: MemberServiceStatus }[];
  };
  referrals: { id: string; contactName: string; createdAt: string; status: string }[];
  upcomingEvents: { id: string; title: string; slug: string; startAt: string }[];
}

interface Booking {
  id: string;
  startAt: string;
  status: string;
  space: { name: string };
}

function ActionRow({ icon: Icon, hue, label, href, count }: { icon: LucideIcon; hue: Hue; label: string; href: string; count: number }) {
  if (!count) return null;
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-xl border border-ink-900/10 bg-white px-4 py-3 hover:border-ink-900/20">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', HUE[hue].soft, HUE[hue].text)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-medium text-ink-800">{label}</span>
        <span className="rounded-pill bg-brand-orange px-2.5 py-0.5 text-xs font-bold tabular-nums text-white">{count}</span>
        <ArrowRight className="h-4 w-4 text-ink-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function ReferralForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ contactName: '', email: '', phone: '', companyName: '', need: '' });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const send = useMutation({
    mutationFn: () => api.post<{ data: { alreadyKnown: boolean } }>('/api/member/referrals', form).then((r) => r.data),
    onSuccess: (r) => {
      setForm({ contactName: '', email: '', phone: '', companyName: '', need: '' });
      setMessage({ ok: true, text: r.alreadyKnown ? 'Merci ! Ce contact est déjà en relation avec notre équipe : votre recommandation est notée.' : 'Merci ! L’équipe IN NETWORK prendra contact avec cette personne.' });
      queryClient.invalidateQueries({ queryKey: ['member-overview'] });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <div>
        <Label htmlFor="ref-name">Nom du contact *</Label>
        <Input id="ref-name" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ref-company">Entreprise</Label>
        <Input id="ref-company" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ref-email">E-mail</Label>
        <Input id="ref-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ref-phone">Téléphone</Label>
        <Input id="ref-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="ref-need">Son besoin, en une phrase</Label>
        <Textarea id="ref-need" rows={2} value={form.need} onChange={(e) => set({ need: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={send.isPending || form.contactName.trim().length < 2 || (!form.email.trim() && !form.phone.trim())}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Recommander
        </Button>
        <span className="text-xs text-ink-500">Un e-mail ou un téléphone suffit.</span>
      </div>
      {message && <p className={cn('text-sm sm:col-span-2', message.ok ? 'text-green-700' : 'text-red-600')}>{message.text}</p>}
    </form>
  );
}

export default function DashboardOverviewPage() {
  const company = useAuthStore((s) => s.user?.company);
  const { data, isLoading } = useQuery({
    queryKey: ['member-overview'],
    queryFn: () => api.get<{ data: Overview }>('/api/member/overview').then((r) => r.data),
  });
  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/api/bookings').then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }

  const upcomingBookings = (bookings ?? []).filter((b) => new Date(b.startAt) > new Date() && b.status !== 'CANCELLED').slice(0, 3);
  const pending = data.actions.quotesToConfirm + data.actions.proformasToPay + data.actions.servicesToValidate + data.actions.servicesToRenew;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-6 text-white shadow-soft-lg sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">Espace membre</p>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">Bonjour{data.firstName ? ` ${data.firstName}` : ''}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          {data.memberSince ? `Membre IN NETWORK depuis le ${dateFr(data.memberSince)}. ` : ''}
          {data.services.active} service{data.services.active > 1 ? 's' : ''} actif{data.services.active > 1 ? 's' : ''}
          {data.services.activating ? `, ${data.services.activating} en cours d’activation` : ''}.
        </p>
        {company && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-xs">
            <Building2 className="h-3.5 w-3.5" /> {company.isOwner ? `Vous gérez le compte ${company.name}` : `Équipe ${company.name}`}
            {company.isOwner && (
              <Link href="/dashboard/equipe" className="font-semibold text-brand-orange hover:underline">
                Gérer
              </Link>
            )}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-bold text-ink-900">À faire</h2>
            {data.requestsInPricing > 0 && (
              <Link href="/dashboard/documents" className="flex items-center gap-3 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm text-ink-800 hover:border-brand-blue/40">
                <Clock className="h-4 w-4 shrink-0 text-brand-blue" />
                <span className="flex-1">
                  {data.requestsInPricing > 1 ? `${data.requestsInPricing} demandes en cours de chiffrage` : 'Votre demande est en cours de chiffrage'} : l’équipe prépare votre devis, vous serez prévenu dès qu’il arrive.
                </span>
                <ArrowRight className="h-4 w-4 text-ink-400" />
              </Link>
            )}
            {pending === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-accent-green/10 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" /> Rien n’attend votre action.
              </p>
            ) : (
              <ul className="space-y-2">
                <ActionRow icon={PackageCheck} hue="violet" label="Services prêts à valider" href="/dashboard/services" count={data.actions.servicesToValidate} />
                <ActionRow icon={ReceiptText} hue="blue" label="Devis à confirmer" href="/dashboard/documents" count={data.actions.quotesToConfirm} />
                <ActionRow icon={ReceiptText} hue="orange" label="Proformas à régler" href="/dashboard/documents#paiement" count={data.actions.proformasToPay} />
                <ActionRow icon={RefreshCw} hue="amber" label="Services à renouveler" href="/dashboard/services" count={data.actions.servicesToRenew} />
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-ink-900">Prochaines échéances</h2>
              <Link href="/dashboard/services" className="text-sm font-medium text-brand-blue hover:underline">
                Mes services
              </Link>
            </div>
            {data.services.nextExpiries.length === 0 ? (
              <p className="text-sm text-ink-500">Aucune échéance à venir.</p>
            ) : (
              <ul className="divide-y divide-ink-900/8 rounded-2xl border border-ink-900/[0.07] bg-white">
                {data.services.nextExpiries.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-ink-800">{s.title}</span>
                    <span className={cn('tabular-nums', s.daysLeft <= 30 ? 'font-semibold text-brand-orange' : 'text-ink-600')}>
                      {dateFr(s.expiresAt)} · J-{s.daysLeft}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
              <Gift className="h-5 w-5 text-brand-orange" /> Recommander un contact
            </h2>
            <p className="text-sm text-ink-600">Une connaissance cherche un espace, une adresse ou de l’aide pour créer son entreprise ? Présentez-la à l’équipe IN NETWORK.</p>
            <ReferralForm />
            {data.referrals.length > 0 && (
              <ul className="space-y-1.5 border-t border-ink-900/8 pt-3 text-sm">
                {data.referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-800">{r.contactName}</span>
                    <span className="text-xs text-ink-500">
                      {dateFr(r.createdAt)} · {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
              <UserRound className="h-4 w-4 text-violet-700" /> Votre référent
            </h2>
            {data.referent ? (
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold text-ink-900">{data.referent.name}</p>
                <p className="text-xs text-ink-500">Votre interlocuteur unique, de l’activation au renouvellement.</p>
                <p className="flex items-center gap-2 text-ink-700">
                  <Mail className="h-3.5 w-3.5 text-ink-400" /> {data.referent.email}
                </p>
                {data.referent.phone && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <Phone className="h-3.5 w-3.5 text-ink-400" /> {data.referent.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-500">Votre référent vous est présenté à l’activation de votre premier service.</p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <CalendarCheck className="h-4 w-4 text-amber-700" /> Mes réservations
              </h2>
              <Link href="/dashboard/reservations" className="text-sm font-medium text-brand-blue hover:underline">
                Réserver
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-ink-500">Aucune réservation à venir.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {upcomingBookings.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3">
                    <span className="text-ink-800">{b.space.name}</span>
                    <span className="text-ink-500">{new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
              <CalendarDays className="h-4 w-4 text-violet-700" /> Prochains événements
            </h2>
            {data.upcomingEvents.length === 0 ? (
              <p className="text-sm text-ink-500">Le prochain programme arrive bientôt.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.upcomingEvents.map((e) => (
                  <li key={e.id}>
                    <Link href={`/evenements/${e.slug}`} className="block hover:underline">
                      <span className="block font-medium text-ink-800">{e.title}</span>
                      <span className="block text-xs text-ink-500">{dateFr(e.startAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
