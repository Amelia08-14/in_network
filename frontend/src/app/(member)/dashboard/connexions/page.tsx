'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageCircle, RefreshCw, Sparkles, Trash2, Users2, X } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/api';

interface Suggestion {
  id: string;
  score: number;
  reason: { type: string; detail: string };
  status: 'NEW' | 'VIEWED' | 'CONTACTED' | 'DISMISSED';
  suggestedUser: {
    id: string;
    profile: { firstName: string; lastName: string; jobTitle: string | null; companyName?: string | null } | null;
  };
}

interface ConnectionRequest {
  id: string;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  fromUser?: { profile: { firstName: string; lastName: string } | null };
  toUser?: { profile: { firstName: string; lastName: string } | null };
}

interface ExpertConnectionRequest {
  id: string;
  message: string;
  status: string;
  expert: { id: string; displayName: string; expertiseArea: string };
}

const statusLabel = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  DECLINED: 'Refusée',
} as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'ACCEPTED' ? 'success' : status === 'DECLINED' ? 'startup' : 'neutral'}>
      {statusLabel[status as keyof typeof statusLabel] ?? status}
    </Badge>
  );
}

export default function ConnexionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['my-suggestions'],
    queryFn: () => api.get<{ data: Suggestion[] }>('/api/connections/suggestions').then((r) => r.data),
  });
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () =>
      api
        .get<{ data: { received: ConnectionRequest[]; sent: ConnectionRequest[]; expertSent: ExpertConnectionRequest[] } }>(
          '/api/connections/requests',
        )
        .then((r) => r.data),
  });

  function showError(error: unknown) {
    setFeedback({
      type: 'error',
      text: error instanceof ApiRequestError ? error.message : 'Une erreur est survenue.',
    });
  }

  const contactMutation = useMutation({
    mutationFn: async (suggestion: Suggestion) => {
      await api.post('/api/connections/requests', {
        toUserId: suggestion.suggestedUser.id,
        message: "Bonjour, votre profil m'intéresse. Je souhaiterais échanger avec vous.",
      });
      await api.patch(`/api/connections/suggestions/${suggestion.id}`, { status: 'CONTACTED' });
    },
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Demande envoyée avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
    },
    onError: showError,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/connections/suggestions/${id}`, { status: 'DISMISSED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-suggestions'] }),
    onError: showError,
  });

  const refreshMatchingMutation = useMutation({
    mutationFn: () => api.post('/api/connections/matching/refresh'),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Vos suggestions networking ont été recalculées.' });
      queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
    },
    onError: showError,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'DECLINED' }) =>
      api.patch(`/api/connections/requests/${id}`, { status }),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'La demande a été mise à jour.' });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, expert }: { id: string; expert?: boolean }) =>
      api.delete(expert ? `/api/connections/expert-requests/${id}` : `/api/connections/requests/${id}`),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'La demande a été supprimée.' });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
    onError: showError,
  });

  function confirmDelete(id: string, expert = false) {
    if (window.confirm('Supprimer définitivement cette demande ?')) {
      deleteMutation.mutate({ id, expert });
    }
  }

  const activeSuggestions = suggestions?.filter((suggestion) => !['DISMISSED', 'CONTACTED'].includes(suggestion.status)) ?? [];
  const receivedPending = requests?.received.filter((request) => request.status === 'PENDING').length ?? 0;
  const sentCount = (requests?.sent.length ?? 0) + (requests?.expertSent.length ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">Réseau</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-3xl font-bold text-ink-900">Networking & mises en relation</h1>
          <Button variant="outline" onClick={() => refreshMatchingMutation.mutate()} disabled={refreshMatchingMutation.isPending}>
            <RefreshCw className={`h-4 w-4 ${refreshMatchingMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculer mes suggestions
          </Button>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Découvrez des membres compatibles avec votre activité et gérez vos relations professionnelles.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent><p className="text-sm text-ink-500">Suggestions actives</p><p className="mt-1 text-3xl font-bold text-ink-900">{activeSuggestions.length}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-ink-500">À traiter</p><p className="mt-1 text-3xl font-bold text-ink-900">{receivedPending}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-ink-500">Demandes envoyées</p><p className="mt-1 text-3xl font-bold text-ink-900">{sentCount}</p></CardContent></Card>
      </div>

      {feedback && (
        <div className={feedback.type === 'success' ? 'rounded-xl bg-accent-green/15 p-3 text-sm text-green-800' : 'rounded-xl bg-brand-orange/10 p-3 text-sm text-brand-orange'}>
          {feedback.text}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between p-5">
          <CardTitle>Suggestions pour vous</CardTitle>
          <Badge variant="neutral">{activeSuggestions.length}</Badge>
        </div>
        <CardContent className="pt-0">
          {suggestionsLoading ? (
            <p className="py-8 text-center text-sm text-ink-500">Calcul des suggestions...</p>
          ) : activeSuggestions.length === 0 ? (
            <EmptyState icon={Sparkles} title="Aucune suggestion active" description="Complétez vos compétences recherchées et proposées pour améliorer le matching." />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {activeSuggestions.map((suggestion) => (
                <li key={suggestion.id} className="rounded-2xl border border-ink-900/[0.08] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {suggestion.suggestedUser.profile?.firstName} {suggestion.suggestedUser.profile?.lastName}
                      </p>
                      <p className="text-sm text-ink-500">{suggestion.suggestedUser.profile?.jobTitle || 'Membre IN NETWORK'}</p>
                    </div>
                    <Badge variant="success">{suggestion.score}%</Badge>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">{suggestion.reason.detail}</p>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => contactMutation.mutate(suggestion)} disabled={contactMutation.isPending}>
                      <MessageCircle className="h-4 w-4" /> Contacter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissMutation.mutate(suggestion.id)} disabled={dismissMutation.isPending}>
                      <X className="h-4 w-4" /> Ignorer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-5">
          <CardTitle>Demandes reçues</CardTitle>
          <Badge variant="neutral">{requests?.received.length ?? 0}</Badge>
        </div>
        <CardContent className="pt-0">
          {requestsLoading ? (
            <p className="py-8 text-center text-sm text-ink-500">Chargement...</p>
          ) : !requests?.received.length ? (
            <EmptyState icon={Users2} title="Aucune demande reçue" />
          ) : (
            <ul className="space-y-3">
              {requests.received.map((request) => (
                <li key={request.id} className="rounded-2xl border border-ink-900/[0.08] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {request.fromUser?.profile?.firstName} {request.fromUser?.profile?.lastName}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">{request.message}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  {request.status === 'PENDING' && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => respondMutation.mutate({ id: request.id, status: 'ACCEPTED' })}>
                        <Check className="h-4 w-4" /> Accepter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ id: request.id, status: 'DECLINED' })}>
                        <X className="h-4 w-4" /> Refuser
                      </Button>
                    </div>
                  )}
                  {request.status === 'DECLINED' && (
                    <Button className="mt-3" size="sm" variant="ghost" onClick={() => confirmDelete(request.id)}>
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-5">
          <CardTitle>Demandes envoyées</CardTitle>
          <Badge variant="neutral">{sentCount}</Badge>
        </div>
        <CardContent className="pt-0">
          {requestsLoading ? (
            <p className="py-8 text-center text-sm text-ink-500">Chargement...</p>
          ) : !sentCount ? (
            <EmptyState title="Aucune demande envoyée" />
          ) : (
            <ul className="space-y-3">
              {requests?.sent.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-900/[0.08] p-4">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {request.toUser?.profile?.firstName} {request.toUser?.profile?.lastName}
                    </p>
                    <p className="mt-1 text-sm text-ink-600">{request.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status} />
                    {request.status !== 'ACCEPTED' && (
                      <Button size="sm" variant="ghost" onClick={() => confirmDelete(request.id)} aria-label="Supprimer la demande">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {requests?.expertSent.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-900/[0.08] p-4">
                  <div>
                    <p className="font-semibold text-ink-900">{request.expert.displayName}</p>
                    <p className="text-xs text-ink-500">{request.expert.expertiseArea}</p>
                    <p className="mt-1 text-sm text-ink-600">{request.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status} />
                    {request.status !== 'ACCEPTED' && (
                      <Button size="sm" variant="ghost" onClick={() => confirmDelete(request.id, true)} aria-label="Supprimer la demande">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
