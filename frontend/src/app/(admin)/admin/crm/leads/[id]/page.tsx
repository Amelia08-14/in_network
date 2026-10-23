'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarCheck,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Eye,
  FileText,
  GitBranch,
  PackageCheck,
  PhoneCall,
  Receipt,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { AppointmentFormModal } from '@/components/admin/AppointmentFormModal';
import { ApproveAccountButton, ProofList } from '@/components/admin/PaymentProofs';
import { AssignControl } from '@/components/admin/AssignControl';
import { QualifyModal } from '@/components/admin/QualifyModal';
import { CircuitModal, DispatchControl, FollowUpModal, LoseModal, VisitModal } from '@/components/admin/LeadFlowControls';
import {
  Avatar,
  CircuitBadge,
  ErrorNote,
  errorMessage,
  Field,
  InvoiceBadge,
  KindBadge,
  OrderBadge,
  Pill,
  PriorityBadge,
  QuoteBadge,
  StageBadge,
  useCrmAccess,
} from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import {
  ACTIVITY_LABEL,
  APPOINTMENT_LABEL,
  CHANNELS,
  CIRCUIT,
  dateFr,
  dateTimeFr,
  invoiceNumber,
  KIND,
  MANUAL_ACTIVITY_TYPES,
  money,
  OFFER_OPTIONS,
  originLabel,
  PIPELINE,
  POLE,
  PRE_VISIT_STAGES,
  SOURCE_LABEL,
  stageLabel,
  staffName,
  toInputDateTime,
} from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { ActivityType, AppointmentStatus, LeadChannel, LeadDetail, LeadPipeline, LeadStage, QuoteTemplate } from '@/types/crm';

// Fiche lead unique (processus v1.3) : d'où vient le prospect, dans quel
// circuit, qui le suit, où il en est — et le geste suivant, proposé selon son
// étape et le profil du compte connecté. Au paiement, elle devient la fiche
// membre (lien vers son panier de services) sans perdre son historique.

const RAIL: LeadStage[] = ['REGISTERED', 'ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED', 'PAID'];

type Modal = 'qualify' | 'followup' | 'visit' | 'circuit' | 'lose' | 'appointment' | null;

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useCrmAccess();
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm-lead', id],
    queryFn: () => api.get<{ data: LeadDetail }>(`/api/admin/crm/leads/${id}`).then((r) => r.data),
  });
  const { data: templates } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: () => api.get<{ data: QuoteTemplate[] }>('/api/admin/quotes/templates').then((r) => r.data),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-lead', id] });
    queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    queryClient.invalidateQueries({ queryKey: ['admin-home'] });
  };
  const onError = (e: unknown) => setError(errorMessage(e));

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/crm/leads/${id}`, body),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError,
  });
  const createQuote = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/admin/quotes', { leadId: id, templateId: templateId || undefined }).then((r) => r.data),
    onSuccess: (quote) => router.push(`/admin/devis/${quote.id}`),
    onError,
  });
  const createProforma = useMutation({
    mutationFn: (quoteId: string | undefined) => api.post<{ data: { id: string } }>('/api/admin/invoices', quoteId ? { quoteId } : { leadId: id }).then((r) => r.data),
    onSuccess: (invoice) => router.push(`/admin/factures/${invoice.id}`),
    onError,
  });
  const reopen = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${id}/reopen`),
    onSuccess: refresh,
    onError,
  });
  const appointmentStatus = useMutation({
    mutationFn: (input: { id: string; status: AppointmentStatus }) => api.patch(`/api/admin/crm/appointments/${input.id}`, { status: input.status }),
    onSuccess: refresh,
    onError,
  });

  if (isLoading) return <p className="text-sm text-ink-500">Chargement…</p>;
  if (!lead) return <EmptyState title="Lead introuvable" />;

  const me = access.userId;
  const closed = lead.stage === 'PAID' || lead.stage === 'LOST';
  const canWrite =
    access.allLeads ||
    lead.assignedToId === me ||
    (lead.salesAgentId === me && !lead.handedOverAt) ||
    (access.manageLeads && !lead.circuit) ||
    (access.salesManager && lead.circuit === 'SALES_TEAM' && !lead.handedOverAt) ||
    (access.officeManager && (lead.circuit === 'OFFICE_MANAGER' || Boolean(lead.handedOverAt)));
  const readOnlyCloser = !canWrite && lead.salesAgentId === me;
  const preVisit = PRE_VISIT_STAGES.includes(lead.stage);
  const acceptedQuote = lead.quotes.find((q) => q.status === 'ACCEPTED');
  const openInvoice = lead.invoices.find((i) => i.status === 'SENT' || i.status === 'DRAFT');
  const railIndex = RAIL.indexOf(lead.stage);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/pipeline" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-ink-400">
              {lead.reference} · {SOURCE_LABEL[lead.source]} · enregistré le {dateFr(lead.createdAt)}
            </p>
            <h1 className="font-heading text-2xl font-bold text-ink-900">{lead.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {lead.contactName}
              {lead.companyName ? ` · ${lead.companyName}` : ''} · {originLabel(lead)}
            </p>
          </div>
          <span className="flex flex-wrap items-center gap-2">
            <KindBadge kind={lead.kind} />
            <CircuitBadge circuit={lead.circuit} />
            <PriorityBadge priority={lead.priority} />
            <StageBadge stage={lead.stage} circuit={lead.circuit} />
          </span>
        </div>
      </div>

      {/* Avancement : affiché, il avance par les gestes du processus. */}
      {lead.stage !== 'LOST' ? (
        <ol aria-label="Avancement du lead" className="flex flex-wrap items-center gap-1.5">
          {RAIL.map((s, index) => {
            const current = lead.stage === s;
            const reached = railIndex >= index;
            return (
              <li
                key={s}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium',
                  current ? 'border-ink-900 bg-ink-900 text-white' : reached ? 'border-ink-900/20 bg-ink-900/8 text-ink-800' : 'border-ink-900/10 bg-white text-ink-400',
                )}
              >
                {reached && !current && <Check className="h-3 w-3" />} {stageLabel(s, lead.circuit)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-ink-900/[0.05] px-4 py-2.5 text-sm text-ink-700">
          Lead clôturé le {dateFr(lead.updatedAt)}
          {lead.lostReason ? ` — ${lead.lostReason}` : ''}.
        </p>
      )}

      <ErrorNote message={error} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Le geste suivant */}
          <Card accent="orange">
            <CardContent className="space-y-3">
              <h2 className="font-heading text-base font-bold text-ink-900">Prochaine étape</h2>

              {readOnlyCloser && (
                <p className="flex items-start gap-2 text-sm text-ink-600">
                  <Eye className="mt-0.5 h-4 w-4 shrink-0" /> Dossier transmis à {staffName(lead.assignedTo)} le {dateFr(lead.handedOverAt)}. Vous en êtes le closer et le suivez en lecture jusqu’au paiement.
                </p>
              )}

              {canWrite && !lead.circuit && !closed && (
                <>
                  <p className="text-sm text-ink-600">Le prospect nécessite-t-il un travail de qualification et de traitement commercial ? Oui : circuit 1. Non : circuit 2.</p>
                  {access.manageLeads ? <DispatchControl lead={lead} /> : <p className="text-sm text-ink-500">En attente d’aiguillage par le responsable commercial ou l’Office Manager.</p>}
                </>
              )}

              {canWrite && lead.circuit === 'SALES_TEAM' && lead.stage === 'REGISTERED' && (
                <>
                  <p className="text-sm text-ink-600">Circuit 1 : à attribuer à un commercial sédentaire (distance, digital, diaspora, offres simples) ou terrain (entreprises, rendez-vous physiques).</p>
                  {access.salesManager || access.direction ? <AssignControl leadId={lead.id} current={null} /> : <p className="text-sm text-ink-500">En attente d’attribution par le responsable commercial.</p>}
                </>
              )}

              {canWrite && preVisit && (
                <>
                  <p className="text-sm text-ink-600">
                    {lead.stage === 'ASSIGNED'
                      ? 'Comprenez le besoin et orientez vers l’offre adaptée, puis obtenez une visite ou une visio.'
                      : lead.stage === 'FOLLOW_UP'
                        ? `Relance en cours (${lead.followUpCount} sans réponse). Obtenez la visite ou la visio.`
                        : 'Lead qualifié : obtenez une visite, une visio ou une journée d’essai.'}
                    {lead.followUpReturnedAt && <strong className="text-brand-orange"> Revenu au responsable après les relances sans réponse.</strong>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={lead.stage === 'ASSIGNED' ? 'primary' : 'outline'} onClick={() => setModal('qualify')}>
                      <ClipboardCheck className="h-4 w-4" /> {lead.qualifiedAt ? 'Mettre à jour la qualification' : 'Qualifier'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setModal('followup')}>
                      <PhoneCall className="h-4 w-4" /> Relance
                    </Button>
                    <Button size="sm" variant={lead.stage === 'ASSIGNED' ? 'outline' : 'primary'} onClick={() => setModal('visit')}>
                      <CalendarCheck className="h-4 w-4" /> {lead.circuit === 'SALES_TEAM' ? 'Visite confirmée · transmettre' : 'Visite / visio confirmée'}
                    </Button>
                    {access.salesManager && lead.circuit === 'SALES_TEAM' && <AssignControl leadId={lead.id} current={lead.salesAgentId} className="w-full" />}
                  </div>
                </>
              )}

              {canWrite && (lead.stage === 'VISIT_CONFIRMED' || lead.stage === 'QUOTE_SENT') && (
                <>
                  <p className="text-sm text-ink-600">
                    {lead.stage === 'VISIT_CONFIRMED'
                      ? 'Préparez le devis : à tarif défini, il part directement ; sur mesure, il passe d’abord par la validation.'
                      : 'Devis envoyé et suivi par e-mail. Dès que le client confirme (en ligne ou par e-mail), le paiement s’organise.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {templates && templates.some((t) => t.isActive) && (
                      <Select aria-label="Modèle de devis" className="h-9 w-auto min-w-56" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                        <option value="">{lead.serviceRequest ? 'Devis pré-rempli avec la demande' : 'Devis vierge'}</option>
                        {templates
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              Modèle : {t.name}
                            </option>
                          ))}
                      </Select>
                    )}
                    <Button size="sm" disabled={createQuote.isPending} onClick={() => createQuote.mutate()}>
                      <FileText className="h-4 w-4" /> {lead.quotes.length ? 'Nouveau devis' : 'Créer le devis'}
                    </Button>
                  </div>
                </>
              )}

              {canWrite && lead.stage === 'CONFIRMED' && (
                <>
                  <p className="text-sm text-ink-600">Devis confirmé : appelez le client pour organiser le paiement (espèces ou virement{lead.channel && ['DIASPORA_FRANCE', 'DIASPORA_CANADA', 'DIASPORA_UAE'].includes(lead.channel) ? ' — virement pour la diaspora' : ''}) et envoyez-lui la facture proforma.</p>
                  {openInvoice ? (
                    <Link href={`/admin/factures/${openInvoice.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
                      <Receipt className="h-4 w-4" /> {openInvoice.status === 'DRAFT' ? 'Finaliser la proforma' : `Proforma ${openInvoice.proformaNumber} : enregistrer le paiement`}
                    </Link>
                  ) : (
                    <Button size="sm" disabled={createProforma.isPending} onClick={() => createProforma.mutate(acceptedQuote?.id)}>
                      <Receipt className="h-4 w-4" /> Préparer la proforma
                    </Button>
                  )}
                </>
              )}

              {lead.stage === 'PAID' && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
                  <PackageCheck className="h-4 w-4 text-green-700" /> Paiement confirmé le {dateFr(lead.wonAt)} : la fiche est devenue fiche membre.
                  {lead.user && (
                    <Link href={`/admin/membres/${lead.user.id}`} className="font-semibold text-brand-blue hover:underline">
                      Ouvrir la fiche membre
                    </Link>
                  )}
                </p>
              )}

              {lead.stage === 'LOST' && access.manageLeads && (
                <Button size="sm" variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
                  <RotateCcw className="h-4 w-4" /> Rouvrir le lead
                </Button>
              )}

              {canWrite && !closed && (
                <div className="flex flex-wrap gap-3 border-t border-ink-900/8 pt-3 text-sm">
                  {lead.circuit && !lead.handedOverAt && !['QUOTE_SENT', 'CONFIRMED'].includes(lead.stage) && (
                    <button type="button" className="inline-flex items-center gap-1.5 text-ink-600 hover:text-ink-900" onClick={() => setModal('circuit')}>
                      <ArrowLeftRight className="h-4 w-4" /> {lead.circuit === 'SALES_TEAM' ? 'Renvoyer à l’Office Manager' : 'Confier à la Sales Team'}
                    </button>
                  )}
                  <button type="button" className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-orange" onClick={() => setModal('lose')}>
                    <X className="h-4 w-4" /> Clôturer
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {lead.qualification && lead.qualifiedAt && <QualificationCard lead={lead} />}

          <InfoCard key={lead.updatedAt} lead={lead} disabled={!canWrite} saving={patch.isPending} onSave={(body) => patch.mutate(body)} />

          {lead.serviceRequest && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="font-heading text-base font-bold text-ink-900">Demande du client</h2>
                <ul className="divide-y divide-ink-900/8 rounded-xl border border-ink-900/8 text-sm">
                  {lead.serviceRequest.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 px-4 py-2.5">
                      <span>{item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title}</span>
                      <span className="tabular-nums text-ink-600">{item.unitPrice ? money(item.unitPrice) : 'Sur devis'}</span>
                    </li>
                  ))}
                </ul>
                {lead.serviceRequest.notes && <p className="whitespace-pre-line rounded-xl bg-ink-900/4 px-4 py-3 text-sm text-ink-700">{lead.serviceRequest.notes}</p>}
              </CardContent>
            </Card>
          )}

          <Journal lead={lead} disabled={!canWrite} onDone={refresh} onError={onError} />
        </div>

        <div className="space-y-6">
          <Card accent="blue">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                <GitBranch className="h-4 w-4 text-ink-500" /> Circuit et intervenants
              </h2>
              <dl className="space-y-2.5 text-sm">
                <Row label="Circuit">{lead.circuit ? CIRCUIT[lead.circuit].label : 'À aiguiller'}</Row>
                <Row label="Pipeline">{lead.pipeline ? PIPELINE[lead.pipeline].label : '—'}</Row>
                {lead.salesAgent && (
                  <Row label={lead.handedOverAt ? 'Commercial (closer)' : 'Commercial'}>
                    <span className="flex items-center gap-2">
                      <Avatar user={lead.salesAgent} /> {staffName(lead.salesAgent)}
                    </span>
                  </Row>
                )}
                <Row label="Intervenant en charge">
                  <span className="flex items-center gap-2">
                    <Avatar user={lead.assignedTo} /> {staffName(lead.assignedTo)}
                  </span>
                </Row>
                {lead.handedOverAt && <Row label="Transmis à l’Office Manager">{dateFr(lead.handedOverAt)}</Row>}
                {lead.user?.referent && <Row label="Référent membre">{staffName(lead.user.referent)}</Row>}
                {lead.referrer && <Row label="Recommandé par">{lead.referrer.profile ? `${lead.referrer.profile.firstName} ${lead.referrer.profile.lastName}` : lead.referrer.email}</Row>}
              </dl>
              {lead.circuitChanges.length > 0 && (
                <div className="space-y-1.5 border-t border-ink-900/8 pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Passerelles</h3>
                  {lead.circuitChanges.map((c) => (
                    <p key={c.id} className="text-xs text-ink-600">
                      {dateFr(c.createdAt)} · {c.fromCircuit ? CIRCUIT[c.fromCircuit].short : 'non aiguillé'} → {CIRCUIT[c.toCircuit].short} par {staffName(c.author)} : {c.reason}
                    </p>
                  ))}
                </div>
              )}
              {(lead.parentLead || lead.childLeads.length > 0) && (
                <div className="space-y-1.5 border-t border-ink-900/8 pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Affaires liées</h3>
                  {lead.parentLead && (
                    <Link href={`/admin/crm/leads/${lead.parentLead.id}`} className="block text-sm text-brand-blue hover:underline">
                      Fiche d’origine : {lead.parentLead.reference} — {lead.parentLead.title}
                    </Link>
                  )}
                  {lead.childLeads.map((c) => (
                    <Link key={c.id} href={`/admin/crm/leads/${c.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="truncate text-ink-800">
                        {KIND[c.kind].label} · {c.title}
                      </span>
                      <StageBadge stage={c.stage} circuit={lead.circuit} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card accent="orange">
            <CardContent className="space-y-4">
              <h2 className="font-heading text-base font-bold text-ink-900">Documents</h2>
              <DocList title="Devis" empty="Aucun devis">
                {lead.quotes.map((q) => (
                  <DocRow key={q.id} href={`/admin/devis/${q.id}`} title={q.number} sub={money(q.total)} badge={<QuoteBadge status={q.status} />} />
                ))}
              </DocList>
              <DocList title="Proformas et factures" empty="Aucune">
                {lead.invoices.map((i) => (
                  <DocRow key={i.id} href={`/admin/factures/${i.id}`} title={invoiceNumber(i)} sub={money(i.total)} badge={<InvoiceBadge status={i.status} />} />
                ))}
              </DocList>
              <DocList title="Services du panier" empty="Aucun service (créés au paiement)">
                {lead.serviceOrders.map((o) => (
                  <DocRow key={o.id} href={`/admin/lancements?order=${o.id}`} icon={<PackageCheck className="h-3.5 w-3.5" />} title={o.title} sub={POLE[o.pole].label} badge={<OrderBadge status={o.status} />} />
                ))}
              </DocList>
              {canWrite && !closed && lead.stage !== 'CONFIRMED' && lead.quotes.length > 0 && (
                <Button size="sm" variant="outline" className="w-full" disabled={createQuote.isPending} onClick={() => createQuote.mutate()}>
                  <FileText className="h-4 w-4" /> Nouveau devis
                </Button>
              )}
            </CardContent>
          </Card>

          {lead.user && (
            <Card accent={lead.user.profile?.isPublic ? 'green' : 'yellow'}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
                    <ShieldCheck className="h-4 w-4 text-ink-500" /> Espace membre
                  </h2>
                  <Pill tone={lead.user.profile?.isPublic ? 'green' : 'amber'}>{lead.user.profile?.isPublic ? 'Actif' : 'Avant paiement'}</Pill>
                </div>
                <p className="text-xs text-ink-500">
                  {lead.user.profile?.isPublic
                    ? 'L’espace du client est actif.'
                    : 'Avant son premier paiement, le client n’a accès qu’à la demande de devis et à « Devis et factures ». L’enregistrement du paiement active son espace.'}
                </p>
                <Link href={`/admin/membres/${lead.user.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
                  <UserRound className="h-4 w-4" /> Fiche membre
                </Link>
                {!lead.user.profile?.isPublic && access.direction && <ApproveAccountButton userId={lead.user.id} onDone={refresh} />}
                {lead.paymentProofs.length === 0 ? <p className="text-sm text-ink-400">Aucun justificatif reçu.</p> : <ProofList proofs={lead.paymentProofs} onChanged={refresh} />}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink-900">Rendez-vous et tâches</h2>
                <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => setModal('appointment')}>
                  <CalendarPlus className="h-4 w-4" /> Programmer
                </Button>
              </div>
              {lead.appointments.length === 0 ? (
                <p className="text-sm text-ink-500">Aucun rendez-vous.</p>
              ) : (
                <ul className="space-y-2">
                  {lead.appointments.map((a) => (
                    <li key={a.id} className="rounded-xl border border-ink-900/8 px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-900">
                          {APPOINTMENT_LABEL[a.type]} — {dateTimeFr(a.startAt)}
                        </span>
                        <Pill tone={a.status === 'DONE' ? 'green' : a.status === 'CANCELLED' ? 'gray' : 'blue'}>{a.status === 'DONE' ? 'Effectué' : a.status === 'CANCELLED' ? 'Annulé' : 'Prévu'}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {staffName(a.assignee)}
                        {a.location ? ` · ${a.location}` : ''}
                      </p>
                      {a.notes && <p className="mt-1 text-xs text-ink-600">{a.notes}</p>}
                      {a.status === 'SCHEDULED' && canWrite && (
                        <div className="mt-2 flex gap-3 text-xs">
                          <button type="button" className="font-medium text-green-700 hover:underline" onClick={() => appointmentStatus.mutate({ id: a.id, status: 'DONE' })}>
                            Marquer effectué
                          </button>
                          <button type="button" className="text-ink-500 hover:text-brand-orange" onClick={() => appointmentStatus.mutate({ id: a.id, status: 'CANCELLED' })}>
                            Annuler
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <QualifyModal key={`q-${lead.updatedAt}`} lead={modal === 'qualify' ? lead : null} onClose={() => setModal(null)} />
      {modal === 'followup' && <FollowUpModal leadId={lead.id} open onClose={() => setModal(null)} />}
      {modal === 'visit' && <VisitModal leadId={lead.id} circuit={lead.circuit} open onClose={() => setModal(null)} />}
      {modal === 'circuit' && lead.circuit && <CircuitModal leadId={lead.id} circuit={lead.circuit} open onClose={() => setModal(null)} />}
      {modal === 'lose' && <LoseModal leadId={lead.id} open onClose={() => setModal(null)} />}
      <AppointmentFormModal key={String(modal === 'appointment')} open={modal === 'appointment'} onClose={() => setModal(null)} leadId={id} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{children}</dd>
    </div>
  );
}

function DocList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-500">{title}</h3>
      {hasRows ? <ul className="space-y-1.5">{children}</ul> : <p className="text-sm text-ink-400">{empty}</p>}
    </div>
  );
}

function DocRow({ href, title, sub, badge, icon }: { href: string; title: string; sub?: string; badge: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm hover:bg-ink-900/3">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-medium text-ink-900">{title}</span>
          {sub && <span className="shrink-0 text-xs tabular-nums text-ink-500">{sub}</span>}
        </span>
        {badge}
      </Link>
    </li>
  );
}

function InfoCard({ lead, saving, disabled, onSave }: { lead: LeadDetail; saving: boolean; disabled: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const initial = {
    title: lead.title,
    contactName: lead.contactName,
    companyName: lead.companyName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    channel: (lead.channel ?? '') as LeadChannel | '',
    channelDetail: lead.channelDetail ?? '',
    offerInterest: lead.offerInterest ?? '',
    expectedAmount: lead.expectedAmount ? String(Number(lead.expectedAmount)) : '',
    nextActionAt: toInputDateTime(lead.nextActionAt),
    notes: lead.notes ?? '',
  };
  const [form, setForm] = useState(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-ink-900">Fiche</h2>
          {!disabled && (
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={() =>
                onSave({
                  ...form,
                  channel: form.channel || null,
                  expectedAmount: form.expectedAmount === '' ? null : Number(form.expectedAmount),
                  nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
                })
              }
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          )}
        </div>
        <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre" htmlFor="f-title" className="sm:col-span-2">
            <Input id="f-title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Contact" htmlFor="f-contact">
            <Input id="f-contact" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="Entreprise" htmlFor="f-company">
            <Input id="f-company" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="f-email">
            <Input id="f-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Téléphone" htmlFor="f-phone">
            <Input id="f-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Canal d’entrée" htmlFor="f-channel">
            <Select id="f-channel" value={form.channel} onChange={(e) => set({ channel: e.target.value as LeadChannel | '' })}>
              <option value="">À préciser</option>
              {(Object.keys(PIPELINE) as LeadPipeline[]).map((pipeline) => (
                <optgroup key={pipeline} label={PIPELINE[pipeline].label}>
                  {CHANNELS.filter((c) => c.pipeline === pipeline).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Précision sur le canal" htmlFor="f-channel-detail">
            <Input id="f-channel-detail" value={form.channelDetail} onChange={(e) => set({ channelDetail: e.target.value })} />
          </Field>
          <Field label="Offre pressentie" htmlFor="f-offer">
            <Select id="f-offer" value={form.offerInterest} onChange={(e) => set({ offerInterest: e.target.value })}>
              <option value="">À déterminer</option>
              {[...new Set([...OFFER_OPTIONS, ...(form.offerInterest ? [form.offerInterest] : [])])].map((offer) => (
                <option key={offer} value={offer}>
                  {offer}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montant estimé (DA)" htmlFor="f-amount">
            <Input id="f-amount" type="number" min="0" value={form.expectedAmount} onChange={(e) => set({ expectedAmount: e.target.value })} />
          </Field>
          <Field label="Prochaine action" htmlFor="f-next" className="sm:col-span-2">
            <Input id="f-next" type="datetime-local" value={form.nextActionAt} onChange={(e) => set({ nextActionAt: e.target.value })} />
            <p className="mt-1 text-xs text-ink-500">Vous serez alerté automatiquement à cette échéance.</p>
          </Field>
          <Field label="Notes" htmlFor="f-notes" className="sm:col-span-2">
            <Textarea id="f-notes" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function Journal({ lead, disabled, onDone, onError }: { lead: LeadDetail; disabled: boolean; onDone: () => void; onError: (e: unknown) => void }) {
  const [type, setType] = useState<ActivityType>('NOTE');
  const [content, setContent] = useState('');

  const add = useMutation({
    mutationFn: () => api.post(`/api/admin/crm/leads/${lead.id}/activities`, { type, content }),
    onSuccess: () => {
      setContent('');
      onDone();
    },
    onError,
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-heading text-base font-bold text-ink-900">Journal</h2>
        {!disabled && (
          <div className="space-y-3 rounded-xl border border-ink-900/8 bg-ink-900/2 p-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Type d’activité">
              {MANUAL_ACTIVITY_TYPES.map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={cn('rounded-pill px-3 py-1 text-xs font-semibold', type === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:bg-ink-900/5')}>
                  {ACTIVITY_LABEL[t]}
                </button>
              ))}
            </div>
            <Textarea aria-label="Nouvelle entrée du journal" rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Compte rendu d’appel, décision, information utile à l’équipe…" />
            <div className="flex justify-end">
              <Button size="sm" disabled={add.isPending || !content.trim()} onClick={() => add.mutate()}>
                {add.isPending ? 'Ajout…' : 'Ajouter au journal'}
              </Button>
            </div>
          </div>
        )}
        <ol className="space-y-4">
          {lead.activities.map((a) => (
            <li key={a.id} className="flex gap-3">
              <Avatar user={a.author} className={a.type === 'SYSTEM' ? 'bg-ink-900/15 text-ink-500' : undefined} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">{a.author ? staffName(a.author) : 'Système'}</span>
                  {a.type !== 'SYSTEM' && ` · ${ACTIVITY_LABEL[a.type]}`} · {dateTimeFr(a.occurredAt)}
                </p>
                <p className={cn('mt-0.5 whitespace-pre-line text-sm', a.type === 'SYSTEM' ? 'text-ink-500' : 'text-ink-800')}>{a.content}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function QualificationCard({ lead }: { lead: LeadDetail }) {
  const q = lead.qualification ?? {};
  const rows: [string, string | null | undefined, boolean?][] = [
    ['Profil', q.profile],
    ['Étape du projet', q.maturity],
    ['Projet', q.project, true],
    ['Besoin réel', q.need, true],
    ['Offre pressentie', lead.offerInterest],
    ['Budget', q.budget],
    ['Décideur', q.decisionMaker],
    ['Délai', q.timeline],
    ['Notes', q.notes, true],
  ];
  return (
    <Card accent="green">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink-900">
            <ClipboardCheck className="h-4 w-4 text-ink-500" /> Qualification
          </h2>
          <PriorityBadge priority={lead.priority} />
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows
            .filter(([, value]) => value)
            .map(([label, value, wide]) => (
              <div key={label} className={wide ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-ink-800">{value}</dd>
              </div>
            ))}
        </dl>
        <p className="text-xs text-ink-500">
          Qualifié{lead.qualifiedBy ? ` par ${staffName(lead.qualifiedBy)}` : ''} le {dateFr(lead.qualifiedAt)}.
        </p>
      </CardContent>
    </Card>
  );
}
