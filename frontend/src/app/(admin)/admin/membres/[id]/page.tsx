'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, FileText, History, IdCard, Mail, PackageCheck, Phone, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentUpload, ServiceOrderModal } from '@/components/admin/ServiceOrderModal';
import { ApproveAccountButton } from '@/components/admin/PaymentProofs';
import { CircuitBadge, errorMessage, InvoiceBadge, KindBadge, MemberServiceBadge, Pill, QuoteBadge, StageBadge, useCrmAccess, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { CHANNEL_LABEL, dateFr, invoiceNumber, money, openAdminPdf, PIPELINE, POLE, SOURCE_LABEL, staffName } from '@/lib/crm';
import type { InvoiceStatus, LeadChannel, LeadCircuit, LeadKind, LeadPipeline, LeadSource, LeadStage, MemberServiceStatus, QuoteStatus, StaffUser } from '@/types/crm';

// Fiche membre (processus v1.3, phase 7) : la fiche lead devenue fiche membre.
// On y garde l'historique commercial (source, circuit, intervenants), et on
// y suit le panier de services, la consommation, les documents remis et le
// référent — l'interlocuteur unique du membre jusqu'au renouvellement.

interface MemberFile {
  member: {
    id: string;
    email: string;
    phone: string | null;
    createdAt: string;
    referent: StaffUser | null;
    profile: {
      firstName: string;
      lastName: string;
      companyName: string | null;
      memberType: string;
      isPublic: boolean;
      city: string | null;
      idDocumentName: string | null;
      idDocumentUploadedAt: string | null;
    } | null;
    company: { id: string; name: string; seatLimit: number } | null;
    memberLeads: {
      id: string;
      reference: string;
      title: string;
      kind: LeadKind;
      stage: LeadStage;
      circuit: LeadCircuit | null;
      pipeline: LeadPipeline | null;
      channel: LeadChannel | null;
      source: LeadSource;
      salesAgent: StaffUser | null;
      createdAt: string;
      wonAt: string | null;
    }[];
  };
  services: {
    id: string;
    title: string;
    pole: keyof typeof POLE;
    amount: string | null;
    status: MemberServiceStatus;
    startsAt: string | null;
    expiresAt: string | null;
    daysLeft: number | null;
    intervenant: string | null;
    progress: number | null;
    renewalStatus: string | null;
  }[];
  history: {
    consumption: {
      plan: { name: string; startDate: string; endDate: string; includedMeetingHours: number } | null;
      meetingHoursUsed: number;
      bookingsCount: number;
      eventsAttended: number;
      eventsRegistered: number;
    };
    quotes: { id: string; number: string; status: QuoteStatus; total: string; sentAt: string | null }[];
    invoices: { id: string; number: string | null; proformaNumber: string | null; status: InvoiceStatus; total: string; paidAt: string | null }[];
    documents: { id: string; title: string; kindLabel: string; createdAt: string; order: { title: string } | null }[];
    timeline: { date: string; kind: string; label: string; detail?: string }[];
  };
}

export default function MemberFilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const access = useCrmAccess();
  const { data: staff } = useStaff('/api/admin/service-orders/staff');
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['member-file', id],
    queryFn: () => api.get<{ data: MemberFile }>(`/api/admin/member-services/${id}`).then((r) => r.data),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['member-file', id] });
  const setReferent = useMutation({
    mutationFn: (referentId: string | null) => api.patch(`/api/admin/member-services/${id}/referent`, { referentId }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!data) return <EmptyState title="Membre introuvable" />;
  const { member, services, history } = data;
  const name = member.profile ? `${member.profile.firstName} ${member.profile.lastName}` : member.email;
  const origin = member.memberLeads.find((l) => l.kind === 'NEW_BUSINESS') ?? member.memberLeads[0];
  const memberSince = member.memberLeads.find((l) => l.wonAt)?.wonAt;
  const c = history.consumption;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/membres" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Membres
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink-900">{name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {member.email}
              </span>
              {member.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {member.phone}
                </span>
              )}
              {(member.company?.name || member.profile?.companyName) && <span>{member.company?.name ?? member.profile?.companyName}</span>}
              <span>{memberSince ? `Membre depuis le ${dateFr(memberSince)}` : `Compte créé le ${dateFr(member.createdAt)}`}</span>
            </p>
            {/* Pièce d'identité exigée pour un profil complet (fichier privé, droit « membres »). */}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <IdCard className="h-4 w-4 text-ink-500" />
              {member.profile?.idDocumentUploadedAt ? (
                <>
                  <span className="text-ink-700">Pièce d’identité envoyée le {dateFr(member.profile.idDocumentUploadedAt)}</span>
                  <button
                    type="button"
                    className="font-semibold text-brand-blue hover:underline"
                    onClick={() => openAdminPdf(`/api/admin/members/${member.id}/id-document`).catch(() => setError('Impossible d’ouvrir la pièce d’identité (droit « Membres » requis).'))}
                  >
                    Voir
                  </button>
                </>
              ) : (
                <span className="font-medium text-amber-700">Pièce d’identité non fournie</span>
              )}
            </p>
          </div>
          <Pill tone={member.profile?.isPublic ? 'green' : 'amber'}>{member.profile?.isPublic ? 'Espace actif' : 'Avant paiement'}</Pill>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card accent="green">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <PackageCheck className="h-4 w-4 text-green-700" /> Panier de services
              </h2>
              {services.length === 0 ? (
                <p className="text-sm text-ink-500">Aucun service : ils entrent dans le panier au paiement.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="py-2 pr-3">Service</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2 pr-3">Début</th>
                        <th className="py-2 pr-3">Échéance</th>
                        <th className="py-2">Intervenant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-900/8">
                      {services.map((s) => (
                        <tr key={s.id} className="cursor-pointer hover:bg-ink-900/3" onClick={() => setOpenOrder(s.id)}>
                          <td className="py-2.5 pr-3">
                            <span className="font-medium text-ink-900">{s.title}</span>
                            <span className="block text-xs text-ink-500">
                              {POLE[s.pole].label}
                              {s.amount ? ` · ${money(s.amount)} HT` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="flex flex-wrap items-center gap-1">
                              <MemberServiceBadge status={s.status} />
                              {s.renewalStatus && <Pill tone="blue">Renouvellement en cours</Pill>}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-ink-600">{dateFr(s.startsAt)}</td>
                          <td className="py-2.5 pr-3 text-ink-600">
                            {s.expiresAt ? dateFr(s.expiresAt) : '—'}
                            {s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 60 && <span className="ml-1 text-xs text-amber-700">(J-{s.daysLeft})</span>}
                          </td>
                          <td className="py-2.5 text-ink-600">{s.intervenant ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card accent="blue">
            <CardContent className="space-y-4">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <History className="h-4 w-4 text-brand-blue" /> Historique de consommation
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-ink-900/[0.04] p-3">
                  <p className="text-xs text-ink-500">Salles de réunion</p>
                  <p className="font-heading text-lg font-bold tabular-nums text-ink-900">
                    {c.meetingHoursUsed} h{c.plan ? ` / ${c.plan.includedMeetingHours} h` : ''}
                  </p>
                  <p className="text-xs text-ink-500">{c.plan ? `Forfait ${c.plan.name}` : 'Aucun forfait en cours'}</p>
                </div>
                <div className="rounded-xl bg-ink-900/[0.04] p-3">
                  <p className="text-xs text-ink-500">Réservations</p>
                  <p className="font-heading text-lg font-bold tabular-nums text-ink-900">{c.bookingsCount}</p>
                </div>
                <div className="rounded-xl bg-ink-900/[0.04] p-3">
                  <p className="text-xs text-ink-500">Événements</p>
                  <p className="font-heading text-lg font-bold tabular-nums text-ink-900">{c.eventsAttended} suivis</p>
                  <p className="text-xs text-ink-500">{c.eventsRegistered} inscriptions</p>
                </div>
              </div>
              {history.timeline.length === 0 ? (
                <p className="text-sm text-ink-500">Rien pour l’instant.</p>
              ) : (
                <ol className="space-y-2 border-l border-ink-900/10 pl-4">
                  {history.timeline.slice(0, 25).map((e, i) => (
                    <li key={`${e.date}-${i}`} className="text-sm">
                      <span className="text-xs tabular-nums text-ink-500">{dateFr(e.date)}</span> · <span className="text-ink-800">{e.label}</span>
                      {e.detail && <span className="text-ink-500"> · {e.detail}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <FileText className="h-4 w-4 text-ink-500" /> Documents remis
              </h2>
              {history.documents.length > 0 && (
                <ul className="space-y-1.5">
                  {history.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-ink-800">{d.title}</span>
                        <span className="block text-xs text-ink-500">
                          {d.kindLabel} · {dateFr(d.createdAt)}
                          {d.order ? ` · ${d.order.title}` : ''}
                        </span>
                      </span>
                      <button type="button" className="text-xs font-medium text-brand-blue hover:underline" onClick={() => openAdminPdf(`/api/admin/member-services/documents/${d.id}/file`).catch((e) => setError(errorMessage(e)))}>
                        Ouvrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <DocumentUpload userId={member.id} onDone={refresh} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card accent="violet">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <UserRound className="h-4 w-4 text-violet-700" /> Référent membre
              </h2>
              <p className="text-xs text-ink-500">Interlocuteur unique du membre, de l’activation au renouvellement : il reçoit les validations et les alertes d’échéance.</p>
              <Select aria-label="Référent" value={member.referent?.id ?? ''} disabled={setReferent.isPending} onChange={(e) => setReferent.mutate(e.target.value || null)}>
                <option value="">Aucun référent</option>
                {staff
                  ?.filter((u) => u.role !== 'SALES_AGENT')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {staffName(u)}
                    </option>
                  ))}
              </Select>
              {!member.profile?.isPublic && access.direction && <ApproveAccountButton userId={member.id} onDone={refresh} />}
            </CardContent>
          </Card>

          <Card accent="blue">
            <CardContent className="space-y-3">
              <h2 className="font-heading text-base font-bold text-ink-900">Historique commercial</h2>
              {origin ? (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Origine</dt>
                    <dd className="text-right text-ink-800">{origin.channel ? CHANNEL_LABEL[origin.channel] : SOURCE_LABEL[origin.source]}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Pipeline</dt>
                    <dd className="text-right text-ink-800">{origin.pipeline ? PIPELINE[origin.pipeline].label : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Circuit</dt>
                    <dd>
                      <CircuitBadge circuit={origin.circuit} />
                    </dd>
                  </div>
                  {origin.salesAgent && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Commercial</dt>
                      <dd className="text-right text-ink-800">{staffName(origin.salesAgent)}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-500">Aucune fiche lead rattachée.</p>
              )}
              <ul className="space-y-1.5 border-t border-ink-900/8 pt-3">
                {member.memberLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/crm/leads/${l.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="min-w-0 truncate text-ink-800">
                        {l.reference} · {l.title}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <KindBadge kind={l.kind} />
                        <StageBadge stage={l.stage} circuit={l.circuit} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card accent="orange">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <CalendarCheck className="h-4 w-4 text-brand-orange" /> Devis et factures
              </h2>
              {history.quotes.length + history.invoices.length === 0 && <p className="text-sm text-ink-500">Aucun document.</p>}
              <ul className="space-y-1.5">
                {history.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/admin/devis/${q.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-ink-900/8 px-3 py-2 text-sm hover:bg-ink-900/3">
                      <span className="text-ink-800">
                        {q.number} · {money(q.total)}
                      </span>
                      <QuoteBadge status={q.status} />
                    </Link>
                  </li>
                ))}
                {history.invoices.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/factures/${i.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-ink-900/8 px-3 py-2 text-sm hover:bg-ink-900/3">
                      <span className="text-ink-800">
                        {invoiceNumber(i)} · {money(i.total)}
                      </span>
                      <InvoiceBadge status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {openOrder && (
        <ServiceOrderModal
          id={openOrder}
          onClose={() => {
            setOpenOrder(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
