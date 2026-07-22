'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Users2 } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/api';

interface Suggestion {
  id: string;
  score: number;
  reason: { type: string; detail: string };
  status: string;
  suggestedUser: { id: string; profile: { firstName: string; lastName: string; jobTitle: string | null } | null };
}
interface ConnectionRequest {
  id: string;
  message: string;
  status: string;
  fromUser?: { profile: { firstName: string; lastName: string } | null };
  toUser?: { profile: { firstName: string; lastName: string } | null };
}

export default function ConnexionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: suggestions } = useQuery({
    queryKey: ['my-suggestions'],
    queryFn: () => api.get<{ data: Suggestion[] }>('/api/connections/suggestions').then((r) => r.data),
  });
  const { data: requests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () =>
      api
        .get<{ data: { received: ConnectionRequest[]; sent: ConnectionRequest[] } }>('/api/connections/requests')
        .then((r) => r.data),
  });

  const contactMutation = useMutation({
    mutationFn: (toUserId: string) =>
      api.post('/api/connections/requests', {
        toUserId,
        message: "Bonjour, ton profil m'intéresse, discutons-en !",
      }),
    onSuccess: () => {
      setFeedback('Demande envoyée.');
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
    onError: (e) => setFeedback(e instanceof ApiRequestError ? e.message : 'Erreur'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'DECLINED' }) =>
      api.patch(`/api/connections/requests/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Connexions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Suggestions basées sur tes compétences et demandes de mise en relation.
        </p>
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Suggestions pour toi</CardTitle>
        </div>
        <CardContent className="pt-0">
          {!suggestions || suggestions.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Pas encore de suggestion"
              description="Complète ton profil (compétences, secteur) pour recevoir des suggestions pertinentes."
            />
          ) : (
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-card border border-gray-100 p-4">
                  <div>
                    <p className="font-medium text-gray-800">
                      {s.suggestedUser.profile?.firstName} {s.suggestedUser.profile?.lastName}
                    </p>
                    <p className="text-xs text-accent-gray">{s.reason.detail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="success">{s.score}/100</Badge>
                    <Button size="sm" variant="secondary" onClick={() => contactMutation.mutate(s.suggestedUser.id)}>
                      Contacter
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {feedback && <p className="mt-3 text-sm text-brand-violet">{feedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <div className="p-5">
          <CardTitle>Demandes reçues</CardTitle>
        </div>
        <CardContent className="pt-0">
          {!requests || requests.received.length === 0 ? (
            <EmptyState icon={Users2} title="Aucune demande reçue" />
          ) : (
            <ul className="space-y-3">
              {requests.received.map((r) => (
                <li key={r.id} className="rounded-card border border-gray-100 p-4">
                  <p className="font-medium text-gray-800">
                    {r.fromUser?.profile?.firstName} {r.fromUser?.profile?.lastName}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{r.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={r.status === 'ACCEPTED' ? 'success' : r.status === 'DECLINED' ? 'startup' : 'neutral'}>
                      {r.status}
                    </Badge>
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="primary" onClick={() => respondMutation.mutate({ id: r.id, status: 'ACCEPTED' })}>
                          Accepter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ id: r.id, status: 'DECLINED' })}>
                          Refuser
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="p-5">
          <CardTitle>Demandes envoyées</CardTitle>
        </div>
        <CardContent className="pt-0">
          {!requests || requests.sent.length === 0 ? (
            <EmptyState title="Aucune demande envoyée" />
          ) : (
            <ul className="space-y-3">
              {requests.sent.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-card border border-gray-100 p-4">
                  <p className="font-medium text-gray-800">
                    {r.toUser?.profile?.firstName} {r.toUser?.profile?.lastName}
                  </p>
                  <Badge variant={r.status === 'ACCEPTED' ? 'success' : r.status === 'DECLINED' ? 'startup' : 'neutral'}>
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
