'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  ReceiptText,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, apiPostForm, openMemberFile } from '@/lib/api';
import { INVOICE_STATUS, QUOTE_STATUS, TONE_CLASS, dateFr, money, type Tone } from '@/lib/crm';
import { HUE } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import type { PaymentProofStatus, Situation, SituationQuote } from '@/types/situation';

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const PROOF_STATUS: Record<PaymentProofStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En cours de vérification', tone: 'amber' },
  ACCEPTED: { label: 'Accepté', tone: 'green' },
  REJECTED: { label: 'Refusé', tone: 'red' },
};

const REQUEST_STATUS: Record<string, string> = {
  NEW: 'Reçue',
  IN_PROGRESS: 'En cours d’étude',
  DONE: 'Traitée',
  CANCELLED: 'Annulée',
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[tone])}>
      {children}
    </span>
  );
}

function Panel({
  id,
  title,
  icon: Icon,
  hue,
  aside,
  children,
}: {
  id?: string;
  title: string;
  icon: typeof FileText;
  hue: keyof typeof HUE;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const style = HUE[hue];
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-ink-900/[0.07] bg-white shadow-soft">
      <header className={cn('flex flex-wrap items-center gap-3 border-b px-5 py-3.5', style.wash, style.border)}>
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', style.soft, style.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-heading text-base font-bold text-ink-900">{title}</h2>
        {aside && <div className="ml-auto text-xs text-ink-500">{aside}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// --- Étapes de validation ---------------------------------------------------------

interface Step {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  alert?: boolean;
  href?: string;
  cta?: string;
}

function buildSteps(s: Situation): Step[] {
  const quoteAccepted = s.quotes.find((q) => q.status === 'ACCEPTED');
  const quoteToAnswer = s.quotes.find((q) => q.status === 'SENT');
  const proofPending = s.proofs.some((p) => p.status === 'PENDING');
  const proofAccepted = s.proofs.some((p) => p.status === 'ACCEPTED') || s.invoices.some((i) => i.status === 'PAID');
  const proofRejected = !proofPending && !proofAccepted && s.proofs[0]?.status === 'REJECTED';

  const devis: Step = quoteAccepted
    ? { key: 'devis', label: 'Devis', done: true, detail: `Devis ${quoteAccepted.number} accepté.` }
    : quoteToAnswer
      ? { key: 'devis', label: 'Devis', done: false, detail: `Le devis ${quoteToAnswer.number} attend votre réponse.`, href: '#devis', cta: 'Voir mon devis' }
      : {
          key: 'devis',
          label: 'Devis',
          done: false,
          detail: s.requests.length
            ? 'Votre demande est en cours d’étude par l’équipe.'
            : 'L’équipe IN NETWORK vous contactera pour établir votre devis.',
        };

  const paiement: Step = proofAccepted
    ? { key: 'paiement', label: 'Paiement', done: true, detail: 'Votre paiement est confirmé.' }
    : proofPending
      ? { key: 'paiement', label: 'Paiement', done: false, detail: 'Reçu envoyé : vérification en cours.' }
      : proofRejected
        ? { key: 'paiement', label: 'Paiement', done: false, alert: true, detail: 'Justificatif refusé : envoyez-en un nouveau.', href: '#paiement', cta: 'Renvoyer un reçu' }
        : quoteAccepted || s.invoices.length
          ? { key: 'paiement', label: 'Paiement', done: false, detail: 'Envoyez votre reçu de paiement.', href: '#paiement', cta: 'Envoyer mon reçu' }
          : { key: 'paiement', label: 'Paiement', done: false, detail: 'Après acceptation de votre devis.' };

  return [
    { key: 'inscription', label: 'Inscription', done: true, detail: 'Votre compte est créé.' },
    s.completeness.isComplete
      ? { key: 'profil', label: 'Profil', done: true, detail: 'Votre profil est complet.' }
      : { key: 'profil', label: 'Profil', done: false, detail: `À compléter : ${s.completeness.missing.join(', ')}.`, href: '/dashboard/profil', cta: 'Compléter mon profil' },
    devis,
    paiement,
    { key: 'validation', label: 'Validation', done: s.validated, detail: 'Dernière étape, par l’équipe IN NETWORK.' },
  ];
}

function StepsTimeline({ steps }: { steps: Step[] }) {
  const currentIndex = steps.findIndex((step) => !step.done);
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const hue = step.done ? HUE.green : step.alert ? HUE.red : isCurrent ? HUE.orange : HUE.gray;
        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn('relative flex flex-col gap-2 rounded-xl border p-4', hue.border, isCurrent || step.done || step.alert ? hue.wash : 'bg-white')}
          >
            <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1 rounded-t-xl', hue.solid)} />
            <div className="flex items-center gap-2.5">
              <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', step.done ? 'bg-accent-green text-white' : cn(hue.soft, hue.text))}>
                {step.done ? <Check className="h-4 w-4" strokeWidth={3} /> : step.alert ? <AlertTriangle className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="font-heading text-sm font-bold text-ink-900">{step.label}</span>
            </div>
            <p className="text-xs leading-relaxed text-ink-600">{step.detail}</p>
            {step.href && !step.done && (
              <Link href={step.href} className={cn('mt-auto text-xs font-semibold hover:underline', hue.text)}>
                {step.cta} →
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// --- Devis ----------------------------------------------------------------------

function QuoteCard({
  quote,
  onAnswer,
  answering,
}: {
  quote: SituationQuote;
  onAnswer: (id: string, decision: 'accept' | 'reject') => void;
  answering: boolean;
}) {
  const status = QUOTE_STATUS[quote.status];
  const [confirmReject, setConfirmReject] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const vat = Number(quote.total) - Number(quote.subtotal);

  async function openPdf() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openMemberFile(`/api/member/quotes/${quote.id}/pdf`);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Impossible d’ouvrir le PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <article className="rounded-xl border border-ink-900/10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-900/8 px-4 py-3">
        <span className="font-heading text-sm font-bold text-ink-900">{quote.number}</span>
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="ml-auto text-xs text-ink-500">
          {quote.sentAt && <>Envoyé le {dateFr(quote.sentAt)}</>}
          {quote.validUntil && <> · valable jusqu’au {dateFr(quote.validUntil)}</>}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-4 py-2">Prestation</th>
              <th className="px-2 py-2 text-right">Qté</th>
              <th className="px-2 py-2 text-right">Prix unitaire</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/6">
            {quote.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2.5 text-ink-800">{line.description}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-600">{Number(line.quantity)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-ink-600">{money(line.unitPrice)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink-900">
                  {money(Number(line.quantity) * Number(line.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto w-full space-y-1 border-t border-ink-900/8 px-4 py-3 text-sm sm:w-72">
        <div className="flex justify-between text-ink-600"><dt>Total HT</dt><dd className="tabular-nums">{money(quote.subtotal)}</dd></div>
        <div className="flex justify-between text-ink-600"><dt>TVA ({Number(quote.vatRate)} %)</dt><dd className="tabular-nums">{money(vat)}</dd></div>
        <div className="flex justify-between font-heading text-base font-bold text-ink-900"><dt>Total TTC</dt><dd className="tabular-nums">{money(quote.total)}</dd></div>
      </dl>

      {quote.notes && <p className="border-t border-ink-900/8 px-4 py-3 text-xs leading-relaxed text-ink-500">{quote.notes}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-900/8 bg-ink-900/[0.02] px-4 py-3">
        <Button size="sm" variant="outline" onClick={openPdf} disabled={pdfLoading}>
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Voir le PDF
        </Button>
        {quote.status === 'SENT' && !confirmReject && (
          <>
            <Button size="sm" onClick={() => onAnswer(quote.id, 'accept')} disabled={answering}>
              {answering ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accepter ce devis
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReject(true)} disabled={answering}>
              Refuser
            </Button>
          </>
        )}
        {quote.status === 'SENT' && confirmReject && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
            Refuser définitivement ce devis ?
            <Button size="sm" variant="secondary" onClick={() => onAnswer(quote.id, 'reject')} disabled={answering}>
              Oui, refuser
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReject(false)}>
              Annuler
            </Button>
          </span>
        )}
        {pdfError && <span role="alert" className="text-xs text-red-600">{pdfError}</span>}
      </div>
    </article>
  );
}

// --- Envoi du reçu -----------------------------------------------------------------

function ProofForm({ situation }: { situation: Situation }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Documents auxquels le reçu peut se rattacher : facture à régler en priorité,
  // sinon devis accepté / en attente de réponse.
  const targets = useMemo(() => {
    const invoices = situation.invoices
      .filter((i) => i.status === 'SENT')
      .map((i) => ({ value: `invoice:${i.id}`, label: `Facture ${i.number} — ${money(i.total)}`, total: i.total }));
    const quotes = situation.quotes
      .filter((q) => q.status === 'ACCEPTED' || q.status === 'SENT')
      .map((q) => ({ value: `quote:${q.id}`, label: `Devis ${q.number} — ${money(q.total)}`, total: q.total }));
    return [...invoices, ...quotes];
  }, [situation.invoices, situation.quotes]);

  const effectiveTarget = target ?? targets.find((t) => t.value.startsWith('invoice:'))?.value ?? targets.find((t) => t.value.startsWith('quote:'))?.value ?? '';
  const targetTotal = targets.find((t) => t.value === effectiveTarget)?.total;
  const effectiveAmount = amount ?? (targetTotal ? String(Number(targetTotal)) : '');

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Joignez votre reçu de paiement (PDF ou image).');
      if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Formats acceptés : PDF, JPG, PNG ou WebP.');
      if (file.size > MAX_PROOF_BYTES) throw new Error('Fichier trop volumineux (10 Mo maximum).');
      const form = new FormData();
      form.append('file', file);
      const [kind, id] = effectiveTarget.split(':');
      if (kind === 'invoice' && id) form.append('invoiceId', id);
      if (kind === 'quote' && id) form.append('quoteId', id);
      if (effectiveAmount.trim()) form.append('amount', effectiveAmount.trim().replace(',', '.'));
      if (reference.trim()) form.append('reference', reference.trim());
      if (note.trim()) form.append('note', note.trim());
      await apiPostForm('/api/member/payment-proofs', form);
    },
    onSuccess: async () => {
      setFile(null);
      setTarget(null);
      setAmount(null);
      setReference('');
      setNote('');
      setError(null);
      setSent(true);
      if (fileInput.current) fileInput.current.value = '';
      await queryClient.invalidateQueries({ queryKey: ['member-situation'] });
    },
    onError: (err: Error) => {
      setSent(false);
      setError(err.message);
    },
  });

  const { rib, holder } = situation.paymentInstructions;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3 text-sm text-ink-600">
        <p>
          Une fois votre virement ou versement effectué, joignez ici le reçu : l’équipe le vérifie puis valide votre
          compte et lance vos services.
        </p>
        <div className="rounded-xl border border-ink-900/10 bg-ink-900/[0.03] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Coordonnées de règlement</p>
          {rib ? (
            <dl className="mt-2 space-y-1">
              <div><dt className="text-xs text-ink-500">Bénéficiaire</dt><dd className="font-medium text-ink-900">{holder}</dd></div>
              <div><dt className="text-xs text-ink-500">RIB / IBAN</dt><dd className="break-all font-mono text-ink-900">{rib}</dd></div>
            </dl>
          ) : (
            <p className="mt-2 text-ink-600">
              Les coordonnées de règlement figurent sur votre facture ou vous sont communiquées par l’équipe IN NETWORK.
            </p>
          )}
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSent(false);
          submit.mutate();
        }}
      >
        <div>
          <Label htmlFor="proof-file">Reçu de paiement *</Label>
          <label
            htmlFor="proof-file"
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm transition-colors',
              file ? 'border-accent-green/60 bg-accent-green/[0.08]' : 'border-ink-900/20 hover:border-brand-orange/50 hover:bg-brand-orange/[0.04]',
            )}
          >
            {file ? <Paperclip className="h-5 w-5 shrink-0 text-green-700" /> : <Upload className="h-5 w-5 shrink-0 text-ink-400" />}
            <span className="min-w-0 truncate text-ink-700">{file ? file.name : 'Choisir un fichier — PDF, JPG, PNG ou WebP (10 Mo max)'}</span>
          </label>
          <input
            id="proof-file"
            ref={fileInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {targets.length > 0 && (
          <div>
            <Label htmlFor="proof-target">Document réglé</Label>
            <Select id="proof-target" value={effectiveTarget} onChange={(event) => { setTarget(event.target.value); setAmount(null); }}>
              <option value="">Aucun / autre</option>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="proof-amount">Montant versé (DA)</Label>
            <Input id="proof-amount" inputMode="decimal" value={effectiveAmount} onChange={(event) => setAmount(event.target.value)} placeholder="ex. 11900" />
          </div>
          <div>
            <Label htmlFor="proof-ref">Référence du virement</Label>
            <Input id="proof-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="N° d’opération" maxLength={190} />
          </div>
        </div>

        <div>
          <Label htmlFor="proof-note">Message pour l’équipe (facultatif)</Label>
          <Textarea id="proof-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {sent && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-accent-green/40 bg-accent-green/10 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Reçu envoyé. L’équipe le vérifie et vous prévient dès que votre compte est validé.
          </p>
        )}

        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer mon reçu
        </Button>
      </form>
    </div>
  );
}

// --- Page ----------------------------------------------------------------------------

export default function SituationPage() {
  const queryClient = useQueryClient();
  const validatedInStore = useAuthStore((s) => s.user?.validated);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member-situation'],
    queryFn: () => api.get<{ data: Situation }>('/api/member/situation').then((r) => r.data),
    refetchInterval: 20_000,
  });

  // Compte validé entre-temps : on rafraîchit l'utilisateur, le layout retire l'onglet et rouvre l'espace.
  useEffect(() => {
    if (data?.validated && validatedInStore === false) void refreshUser();
  }, [data?.validated, validatedInStore, refreshUser]);

  const answer = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'reject' }) =>
      api.post<{ data: Situation }>(`/api/member/quotes/${id}/${decision}`).then((r) => r.data),
    onSuccess: (next) => {
      setAnswerError(null);
      queryClient.setQueryData(['member-situation'], next);
    },
    onError: (err: Error) => setAnswerError(err.message),
  });

  const steps = useMemo(() => (data ? buildSteps(data) : []), [data]);
  const current = steps.find((step) => !step.done);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre situation…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Impossible de charger votre situation pour le moment. Réessayez dans un instant.
      </p>
    );
  }

  async function openProof(id: string) {
    setOpenError(null);
    try {
      await openMemberFile(`/api/member/payment-proofs/${id}/file`);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Impossible d’ouvrir le document.');
    }
  }

  async function openInvoice(id: string) {
    setOpenError(null);
    try {
      await openMemberFile(`/api/member/invoices/${id}/pdf`);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Impossible d’ouvrir le document.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-6 text-white shadow-soft-lg sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <span className="hidden h-11 w-11 shrink-0 md:inline-flex items-center justify-center rounded-xl bg-white/10 text-accent-yellow">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-yellow/20 px-3 py-1 text-xs font-semibold text-accent-yellow">
              <Clock className="h-3.5 w-3.5" /> Compte en attente de validation
            </span>
            <h1 className="mt-3 font-heading text-2xl font-bold text-white sm:text-3xl">Situation de votre compte</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
              Suivez ici l’avancement de votre validation, répondez à votre devis et envoyez votre reçu de paiement.
              Les autres onglets s’ouvrent dès que l’équipe IN NETWORK valide votre compte.
            </p>
            {current && (
              <p className="mt-4 text-sm">
                <span className="text-white/60">Prochaine étape :</span>{' '}
                <span className="font-semibold text-white">{current.label}</span>
                <span className="text-white/75"> — {current.detail}</span>
              </p>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2.5 self-start rounded-xl bg-white/[0.07] px-4 py-3 text-sm">
            {data.account.isCompany && <Building2 className="h-4 w-4 text-white/70" />}
            <div>
              <p className="font-semibold">{data.account.companyName ?? data.account.name ?? data.account.email}</p>
              <p className="break-all text-xs text-white/60">
                {data.account.isCompany && data.account.seatLimit ? `Compte entreprise · ${data.account.seatLimit} postes` : data.account.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <StepsTimeline steps={steps} />

      {(answerError || openError) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {answerError ?? openError}
        </p>
      )}

      <Panel id="devis" title="Mes devis" icon={FileText} hue="blue" aside={data.quotes.length ? `${data.quotes.length} devis` : undefined}>
        {data.quotes.length === 0 ? (
          <div className="space-y-4 text-sm text-ink-600">
            <p>
              {data.requests.length
                ? 'Votre demande a bien été reçue : l’équipe prépare votre devis et vous le transmet ici dès qu’il est prêt.'
                : 'Aucun devis pour le moment. Dès que l’équipe IN NETWORK aura préparé le vôtre, vous pourrez le consulter, l’accepter ou le refuser directement ici.'}
            </p>
            {data.requests.length > 0 && (
              <ul className="space-y-2">
                {data.requests.map((request) => (
                  <li key={request.id} className="rounded-xl border border-ink-900/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={request.status === 'DONE' ? 'green' : request.status === 'CANCELLED' ? 'gray' : 'blue'}>
                        {REQUEST_STATUS[request.status] ?? request.status}
                      </Pill>
                      <span className="text-xs text-ink-500">Demande du {dateFr(request.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-ink-800">
                      {request.items.map((item) => (item.tierLabel ? `${item.title} (${item.tierLabel})` : item.title)).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {data.quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                answering={answer.isPending && answer.variables?.id === quote.id}
                onAnswer={(id, decision) => answer.mutate({ id, decision })}
              />
            ))}
          </div>
        )}
      </Panel>

      {data.invoices.length > 0 && (
        <Panel title="Mes factures" icon={ReceiptText} hue="amber">
          <ul className="divide-y divide-ink-900/8">
            {data.invoices.map((invoice) => {
              const status = INVOICE_STATUS[invoice.status];
              return (
                <li key={invoice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm first:pt-0 last:pb-0">
                  <span className="font-heading font-bold text-ink-900">{invoice.number}</span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  <span className="tabular-nums text-ink-700">{money(invoice.total)}</span>
                  <span className="text-xs text-ink-500">
                    {invoice.paidAt ? `Payée le ${dateFr(invoice.paidAt)}` : invoice.dueDate ? `Échéance : ${dateFr(invoice.dueDate)}` : ''}
                  </span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => openInvoice(invoice.id)}>
                    <FileText className="h-4 w-4" /> PDF
                  </Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel id="paiement" title="Envoyer mon reçu de paiement" icon={Upload} hue="orange">
        <ProofForm situation={data} />
        {data.proofs.length > 0 && (
          <div className="mt-6 border-t border-ink-900/8 pt-5">
            <h3 className="font-heading text-sm font-bold text-ink-900">Reçus envoyés</h3>
            <ul className="mt-3 space-y-2">
              {data.proofs.map((proof) => {
                const status = PROOF_STATUS[proof.status];
                return (
                  <li key={proof.id} className="rounded-xl border border-ink-900/10 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Pill tone={status.tone}>{status.label}</Pill>
                      <span className="min-w-0 truncate font-medium text-ink-800">{proof.fileName}</span>
                      <span className="text-xs text-ink-500">
                        {dateFr(proof.createdAt)}
                        {proof.amount ? ` · ${money(proof.amount)}` : ''}
                        {proof.reference ? ` · réf. ${proof.reference}` : ''}
                        {proof.invoice ? ` · facture ${proof.invoice.number}` : proof.quote ? ` · devis ${proof.quote.number}` : ''}
                      </span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openProof(proof.id)}>
                        Voir
                      </Button>
                    </div>
                    {proof.status === 'REJECTED' && proof.reviewNote && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Motif du refus : {proof.reviewNote}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
