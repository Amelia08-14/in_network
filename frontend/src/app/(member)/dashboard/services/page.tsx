'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, FileText, Loader2, PackageCheck, Plus, RefreshCw, UserRound, Wrench } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { api, openMemberFile } from '@/lib/api';
import { dateFr, MEMBER_SERVICE_STATUS, money, TONE_CLASS } from '@/lib/crm';
import { HUE } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { MemberServiceStatus } from '@/types/crm';

// « Mes services » : le panier de services du membre (processus v1.3, phase 7).
// Chaque service vendu y figure avec son offre, son montant, son statut, ses
// dates et son intervenant. Le membre y suit l'activation, valide la mise en
// service (ou demande un ajustement), voit ses échéances et renouvelle en un clic.

interface MyService {
  id: string;
  title: string;
  poleLabel: string;
  subsidiary: string | null;
  amount: string | null;
  status: MemberServiceStatus;
  deliveryLabel: string;
  progress: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  readyAt: string | null;
  completedAt: string | null;
  adjustmentNote: string | null;
  intervenant: string | null;
  renewedFrom: { id: string; title: string } | null;
  renewalStatus: string | null;
  canRenew: boolean;
  documents: { id: string; title: string; kindLabel: string; createdAt: string }[];
}

const GROUPS: { title: string; statuses: MemberServiceStatus[] }[] = [
  { title: 'À votre attention', statuses: ['AWAITING_VALIDATION', 'TO_RENEW', 'EXPIRED'] },
  { title: 'En cours d’activation', statuses: ['ACTIVATING', 'ADJUSTMENT_REQUESTED'] },
  { title: 'Actifs', statuses: ['ACTIVE'] },
  { title: 'Historique', statuses: ['RENEWED', 'CANCELLED'] },
];

function StatusPill({ status }: { status: MemberServiceStatus }) {
  const meta = MEMBER_SERVICE_STATUS[status];
  return <span className={cn('inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[meta.tone])}>{meta.label}</span>;
}

function ServiceCard({ service }: { service: MyService }) {
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState('');
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tone = HUE[MEMBER_SERVICE_STATUS[service.status].tone];

  const act = useMutation({
    mutationFn: (input: { path: 'validate' | 'adjustment' | 'renew'; body?: Record<string, unknown> }) =>
      api.post<{ data: MyService[] }>(`/api/member/services/${service.id}/${input.path}`, input.body).then((r) => r.data),
    onSuccess: (services, input) => {
      setError(null);
      setAdjusting(false);
      setConfirmRenew(false);
      setNotice(input.path === 'renew' ? 'Demande de renouvellement envoyée : votre devis arrive dans « Devis et factures ».' : input.path === 'adjustment' ? 'Votre demande d’ajustement est transmise à l’équipe.' : null);
      queryClient.setQueryData(['my-services'], services);
      queryClient.invalidateQueries({ queryKey: ['member-overview'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  async function openDocument(id: string) {
    try {
      await openMemberFile(`/api/member/documents/${id}/file`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ouvrir le document.');
    }
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-ink-900/[0.07] bg-white p-5 shadow-soft">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', tone.solid)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-ink-900">{service.title}</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {service.poleLabel}
            {service.subsidiary ? ` · ${service.subsidiary}` : ''}
            {service.amount ? ` · ${money(service.amount)} HT` : ''}
          </p>
        </div>
        <StatusPill status={service.status} />
      </div>

      {service.status === 'ACTIVATING' && service.progress !== null && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/8" role="progressbar" aria-valuenow={service.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement de la mise en place">
            <div className="h-full rounded-full bg-brand-orange" style={{ width: `${service.progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-500">Mise en place : {service.progress} %</p>
        </div>
      )}
      {service.status === 'ADJUSTMENT_REQUESTED' && service.adjustmentNote && <p className="mt-3 rounded-xl bg-brand-orange/10 px-3 py-2 text-sm text-brand-orange">Ajustement en cours : {service.adjustmentNote}</p>}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-500">Début</dt>
          <dd className="font-medium text-ink-800">{service.startsAt ? dateFr(service.startsAt) : 'À l’activation'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Échéance</dt>
          <dd className={cn('font-medium', service.daysLeft !== null && service.daysLeft <= 30 ? 'text-brand-orange' : 'text-ink-800')}>
            {service.expiresAt ? (
              <>
                {dateFr(service.expiresAt)}
                {service.daysLeft !== null && service.daysLeft >= 0 && service.status !== 'RENEWED' && <span className="text-xs font-normal text-ink-500"> · dans {service.daysLeft} j</span>}
              </>
            ) : (
              'Sans échéance'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Intervenant</dt>
          <dd className="flex items-center gap-1.5 font-medium text-ink-800">
            <UserRound className="h-3.5 w-3.5 text-ink-400" /> {service.intervenant ?? 'L’équipe IN NETWORK'}
          </dd>
        </div>
      </dl>

      {service.documents.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {service.documents.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => openDocument(d.id)} className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900/[0.05] px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-900/10">
                <FileText className="h-3.5 w-3.5" /> {d.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {service.status === 'AWAITING_VALIDATION' && (
        <div className="mt-4 space-y-3 rounded-xl bg-violet-600/[0.05] p-4">
          <p className="text-sm text-ink-700">Votre service est prêt. Vérifiez-le (accès, attestation, documents) puis confirmez la mise en service.</p>
          {adjusting ? (
            <div className="space-y-2">
              <Textarea aria-label="Ce qui doit être corrigé" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Décrivez ce qui doit être corrigé" autoFocus />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={act.isPending || note.trim().length < 3} onClick={() => act.mutate({ path: 'adjustment', body: { note } })}>
                  Envoyer la demande
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdjusting(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ path: 'validate' })}>
                {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Tout est conforme
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdjusting(true)}>
                <Wrench className="h-4 w-4" /> Demander un ajustement
              </Button>
            </div>
          )}
        </div>
      )}

      {service.renewalStatus && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-700">
          <RefreshCw className="h-4 w-4 text-brand-blue" /> Renouvellement en cours : retrouvez votre devis dans{' '}
          <Link href="/dashboard/documents" className="font-semibold text-brand-blue hover:underline">
            Devis et factures
          </Link>
          .
        </p>
      )}
      {service.canRenew && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmRenew ? (
            <>
              <span className="text-sm text-ink-700">Nous vous envoyons un devis de renouvellement au tarif en vigueur.</span>
              <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ path: 'renew' })}>
                {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Confirmer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRenew(false)}>
                Annuler
              </Button>
            </>
          ) : (
            <Button size="sm" variant={service.status === 'ACTIVE' ? 'outline' : 'primary'} onClick={() => setConfirmRenew(true)}>
              <RefreshCw className="h-4 w-4" /> Renouveler
            </Button>
          )}
        </div>
      )}

      {notice && <p className="mt-3 text-sm text-green-700">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}

export default function MyServicesPage() {
  const { data: services, isLoading, isError } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => api.get<{ data: MyService[] }>('/api/member/services').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const all = services ?? [];
  const count = (statuses: MemberServiceStatus[]) => all.filter((s) => statuses.includes(s.status)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink-900">Mes services</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">L’avancement de chaque service, ses dates et ses documents. Vous êtes prévenu à chaque changement et avant chaque échéance.</p>
        </div>
        <Link href="/dashboard/catalogue" className={cn(buttonVariants({ variant: 'primary' }), 'gap-2')}>
          <Plus className="h-4 w-4" /> Demander un service
        </Link>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-red-600">
          Vos services n’ont pas pu être chargés. Réessayez dans un instant.
        </p>
      ) : all.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Aucun service pour l’instant" description="Vos services apparaissent ici dès leur paiement, avec leur avancement et leur échéance." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Actifs', value: count(['ACTIVE', 'TO_RENEW']), icon: CheckCircle2, hue: HUE.green },
              { label: 'En cours d’activation', value: count(['ACTIVATING', 'AWAITING_VALIDATION', 'ADJUSTMENT_REQUESTED']), icon: Loader2, hue: HUE.blue },
              { label: 'À renouveler', value: count(['TO_RENEW', 'EXPIRED']), icon: CalendarClock, hue: HUE.amber },
            ].map((k) => (
              <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-ink-900/[0.07] bg-white p-4 shadow-soft">
                <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', k.hue.soft, k.hue.text)}>
                  <k.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-heading text-xl font-bold tabular-nums text-ink-900">{k.value}</span>
                  <span className="block text-xs text-ink-500">{k.label}</span>
                </span>
              </div>
            ))}
          </div>
          {GROUPS.map((group) => {
            const items = all.filter((s) => group.statuses.includes(s.status));
            if (items.length === 0) return null;
            return (
              <section key={group.title} className="space-y-3">
                <h2 className="font-heading text-lg font-bold text-ink-900">{group.title}</h2>
                <div className="grid gap-4 xl:grid-cols-2">
                  {items.map((s) => (
                    <ServiceCard key={s.id} service={s} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
