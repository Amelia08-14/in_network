'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Hourglass, ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { errorMessage, ErrorNote, PageTitle } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { dateTimeFr, money, staffName } from '@/lib/crm';
import type { ApprovalItem, ApprovalsData } from '@/types/crm';

// « À valider » (retours IN NETWORK du 22/11/2026) : l'administrateur ne
// trouvait pas la demande de remise envoyée par l'Office Manager. Toutes les
// demandes de validation (remise, prix ajusté, service sur devis, montant
// élevé) sont ici, avec leur motif, et se traitent sans quitter la page.
// L'auteur d'une demande y suit aussi les siennes, en attente.

export default function ValidationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['quote-approvals'],
    queryFn: () => api.get<{ data: ApprovalsData }>('/api/admin/quotes/approvals').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageTitle
        hue="amber"
        title="À valider"
        description="Les devis avec une remise, un prix ajusté ou un service sur devis attendent une validation avant de partir au client. Validez : le devis est envoyé aussitôt et l’auteur est prévenu. Renvoyez : il revient à son auteur avec votre commentaire."
      />

      {isLoading && <p className="text-sm text-ink-500">Chargement…</p>}

      {data && (
        <>
          <section className="space-y-3" aria-labelledby="to-approve">
            <h2 id="to-approve" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
              <ShieldCheck className="h-5 w-5 text-amber-700" /> Demandes à traiter
              {data.toApprove.length > 0 && <span className="rounded-pill bg-brand-orange px-2.5 py-0.5 text-sm text-white">{data.toApprove.length}</span>}
            </h2>
            {data.toApprove.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-6 text-sm text-ink-600">
                  <CheckCircle2 className="h-5 w-5 text-accent-green" /> Aucune demande de validation ne vous attend.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-3">
                {data.toApprove.map((item) => (
                  <li key={item.id}>
                    <ApprovalCard item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.waiting.length > 0 && (
            <section className="space-y-3" aria-labelledby="waiting">
              <h2 id="waiting" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
                <Hourglass className="h-5 w-5 text-ink-500" /> Mes demandes en attente
              </h2>
              <ul className="space-y-2">
                {data.waiting.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                    <span className="min-w-0 text-amber-950">
                      <strong>{item.number}</strong> — {item.lead.contactName} · {money(item.total)} TTC
                      <span className="block text-xs text-amber-900/80">
                        En attente de validation par {item.approverLabel} depuis le {dateTimeFr(item.submittedAt)}. Vous serez prévenu(e) dès la réponse.
                      </span>
                    </span>
                    <Link href={`/admin/devis/${item.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline">
                      Voir le devis <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.toApprove.length === 0 && data.waiting.length === 0 && (
            <EmptyState icon={ShieldCheck} title="Rien en attente" description="Les demandes de remise et de prix ajusté apparaîtront ici, avec une alerte dans la cloche et par e-mail." className="py-8" />
          )}
        </>
      )}
    </div>
  );
}

function ApprovalCard({ item }: { item: ApprovalItem }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['quote-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['admin-home'] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  };
  const approve = useMutation({
    mutationFn: () => api.post<{ data: { emailed: boolean; emailError?: string } }>(`/api/admin/quotes/${item.id}/approve`).then((r) => r.data),
    onSuccess: (result) => {
      setDone(result.emailed ? 'Validé et envoyé au client par e-mail.' : 'Validé. L’e-mail au client n’est pas parti : remettez-lui le devis.');
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const sendBack = useMutation({
    mutationFn: () => api.post(`/api/admin/quotes/${item.id}/return`, { comment }),
    onSuccess: () => {
      setDone('Renvoyé à son auteur avec votre commentaire.');
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const busy = approve.isPending || sendBack.isPending;
  const discount = Number(item.discountAmount);

  return (
    <Card accent="orange">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-ink-400">
              {item.number} · demandé par {item.createdBy ? staffName(item.createdBy) : 'la plateforme'} le {dateTimeFr(item.submittedAt)}
            </p>
            <h3 className="font-heading text-lg font-bold text-ink-900">
              {item.lead.contactName}
              {item.lead.companyName ? ` · ${item.lead.companyName}` : ''}
            </h3>
            <Link href={`/admin/crm/leads/${item.lead.id}`} className="text-xs text-ink-500 hover:text-brand-blue">
              Fiche {item.lead.reference} — {item.lead.title}
            </Link>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-bold tabular-nums text-ink-900">{money(item.total)} TTC</p>
            {discount > 0 && <p className="text-xs font-semibold text-brand-orange">Remise accordée : {money(discount)} HT</p>}
          </div>
        </div>

        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200">
          <strong>Pourquoi une validation :</strong> {item.reasons.join(', ')}.
        </p>

        {done ? (
          <p className="flex items-center gap-2 text-sm font-medium text-green-800" role="status">
            <CheckCircle2 className="h-4 w-4" /> {done}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => approve.mutate()}>
                <ShieldCheck className="h-4 w-4" /> {approve.isPending ? 'Envoi…' : 'Valider et envoyer au client'}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowReturn((v) => !v)}>
                <Undo2 className="h-4 w-4" /> Renvoyer pour modification
              </Button>
              <Link href={`/admin/devis/${item.id}`} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
                Voir le détail du devis <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {showReturn && (
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Ce qui doit être revu" className="min-w-64 flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ce qui doit être revu (ex. remise limitée à 10 %)" autoFocus />
                <Button size="sm" variant="outline" disabled={busy || comment.trim().length < 3} onClick={() => sendBack.mutate()}>
                  Renvoyer
                </Button>
              </div>
            )}
            <ErrorNote message={error} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
