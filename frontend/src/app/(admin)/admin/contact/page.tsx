'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Reply, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  replyText: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export default function AdminContactPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contact-messages', page],
    queryFn: () => api.get<ApiListResponse<AdminContactMessage>>(`/api/admin/contact-messages?page=${page}&limit=20`),
  });

  const readMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      api.patch(`/api/admin/contact-messages/${id}`, { isRead }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post(`/api/admin/contact-messages/${id}/reply`, { reply: text }),
    onSuccess: () => {
      setFeedback('Réponse envoyée par email.');
      setReplyingTo(null);
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
    },
    onError: (error) => setFeedback(error instanceof ApiRequestError ? error.message : "Impossible d'envoyer la réponse."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/contact-messages/${id}`),
    onSuccess: () => {
      setFeedback('Message supprimé.');
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
    },
  });

  const unreadCount = data?.data.filter((message) => !message.isRead).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Messages de contact</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data?.meta.total ?? 0} message{(data?.meta.total ?? 0) > 1 ? 's' : ''} · {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
        </p>
      </div>

      {feedback && <p className="rounded-xl bg-accent-green/15 p-3 text-sm text-green-800">{feedback}</p>}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : !data?.data.length ? (
            <EmptyState icon={Mail} title="Aucun message pour le moment" />
          ) : (
            <div className="divide-y divide-ink-900/[0.06]">
              {data.data.map((message) => (
                <article key={message.id} className={`p-5 ${!message.isRead ? 'bg-brand-orange/[0.03]' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink-900">{message.name}</p>
                        <a href={`mailto:${message.email}`} className="text-xs text-brand-blue hover:underline">{message.email}</a>
                        {!message.isRead && <Badge variant="startup">Non lu</Badge>}
                        {message.repliedAt && <Badge variant="success">Répondu</Badge>}
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{message.message}</p>
                      <p className="mt-2 text-xs text-ink-500">{new Date(message.createdAt).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplyingTo(message.id);
                          setReply(message.replyText ?? '');
                          if (!message.isRead) readMutation.mutate({ id: message.id, isRead: true });
                        }}
                      >
                        <Reply className="h-4 w-4" /> {message.repliedAt ? 'Répondre à nouveau' : 'Répondre'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm('Supprimer définitivement ce message ?')) deleteMutation.mutate(message.id);
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {message.replyText && replyingTo !== message.id && (
                    <div className="mt-4 rounded-xl border-l-2 border-accent-green bg-accent-green/[0.08] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Votre réponse</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{message.replyText}</p>
                    </div>
                  )}

                  {replyingTo === message.id && (
                    <div className="mt-4 max-w-2xl space-y-3 rounded-2xl border border-ink-900/[0.08] bg-white p-4">
                      <p className="text-sm font-semibold text-ink-900">Répondre à {message.name}</p>
                      <Textarea rows={5} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Rédigez votre réponse..." />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!reply.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: message.id, text: reply })}
                        >
                          {replyMutation.isPending ? 'Envoi...' : 'Envoyer par email'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={!data.meta.hasPrevPage} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
          <span className="text-sm text-ink-500">Page {data.meta.page} / {data.meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={!data.meta.hasNextPage} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
        </div>
      )}
    </div>
  );
}
