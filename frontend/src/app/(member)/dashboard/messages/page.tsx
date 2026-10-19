'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Handshake, MessageCircle, Send } from 'lucide-react';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

// Messagerie entre membres (demande client 19/10/2026) : une mise en relation
// acceptée ouvre une conversation privée. Actualisation par interrogation
// régulière (pas de connexion permanente à maintenir côté serveur) : 5 s dans
// un fil ouvert, 15 s pour la liste.

interface Peer {
  userId: string;
  profileId: string | null;
  name: string;
  jobTitle: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  companyLogoUrl: string | null;
  isActive: boolean;
}
interface Conversation {
  id: string;
  peer: Peer;
  lastMessage: { body: string; fromMe: boolean; createdAt: string };
  unread: number;
}
interface ThreadMessage {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
  readAt: string | null;
}
interface Thread {
  id: string;
  peer: Peer;
  intro: { fromMe: boolean; body: string; createdAt: string };
  messages: ThreadMessage[];
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function formatDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShort(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? formatTime(iso)
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function sendErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return 'Message non envoyé. Vérifiez votre connexion puis réessayez.';
}

function ConversationList({ activeId }: { activeId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ data: Conversation[] }>('/api/messages/conversations').then((r) => r.data),
    refetchInterval: 15_000,
  });

  if (isLoading) return <p className="p-5 text-sm text-ink-500">Chargement…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          icon={Handshake}
          title="Aucune conversation"
          description="Dès qu’une mise en relation est acceptée, vous pouvez échanger ici avec la personne."
          action={
            <Link href="/dashboard/networking" className="text-sm font-semibold text-brand-blue hover:underline">
              Voir mes mises en relation
            </Link>
          }
          className="py-10"
        />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-ink-900/8">
      {data.map((conversation) => (
        <li key={conversation.id}>
          <Link
            href={`/dashboard/messages?c=${conversation.id}`}
            aria-current={conversation.id === activeId ? 'page' : undefined}
            className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-900/[0.03]', conversation.id === activeId && 'bg-ink-900/[0.05]')}
          >
            <AvatarPlaceholder name={conversation.peer.name} photoUrl={conversation.peer.avatarUrl} size={44} className="rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn('truncate text-sm text-ink-900', conversation.unread > 0 ? 'font-bold' : 'font-semibold')}>{conversation.peer.name}</span>
                <span className="shrink-0 text-[11px] text-ink-400">{formatShort(conversation.lastMessage.createdAt)}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={cn('truncate text-sm', conversation.unread > 0 ? 'font-medium text-ink-800' : 'text-ink-500')}>
                  {conversation.lastMessage.fromMe ? 'Vous : ' : ''}
                  {conversation.lastMessage.body}
                </span>
                {conversation.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white" aria-label={`${conversation.unread} message(s) non lu(s)`}>
                    {conversation.unread}
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ThreadView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading, isError } = useQuery({
    queryKey: ['thread', id],
    queryFn: () => api.get<{ data: Thread }>(`/api/messages/conversations/${id}`).then((r) => r.data),
    refetchInterval: 5_000,
  });

  // Les messages reçus sont marqués lus à l'ouverture du fil : on rafraîchit les pastilles.
  const loaded = Boolean(thread);
  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    if (!loaded) return;
    queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [loaded, messageCount, queryClient]);

  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [count, id]);

  const send = useMutation({
    mutationFn: (body: string) => api.post(`/api/messages/conversations/${id}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => setError(sendErrorMessage(e)),
  });

  function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  }

  if (isLoading) return <p className="p-6 text-sm text-ink-500">Chargement…</p>;
  if (isError || !thread) {
    return (
      <div className="p-6">
        <EmptyState title="Conversation introuvable" description="Elle n’existe plus ou ne vous est pas accessible." className="py-10" />
      </div>
    );
  }

  // Séparateurs de jour entre les messages.
  const items = [
    { id: 'intro', fromMe: thread.intro.fromMe, body: thread.intro.body, createdAt: thread.intro.createdAt, intro: true },
    ...thread.messages.map((m) => ({ ...m, intro: false })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-900/8 px-4 py-3">
        <button type="button" onClick={() => router.push('/dashboard/messages')} className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/5 lg:hidden" aria-label="Retour aux conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <AvatarPlaceholder name={thread.peer.name} photoUrl={thread.peer.avatarUrl} size={40} className="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold text-ink-900">{thread.peer.name}</p>
          <p className="truncate text-xs text-ink-500">{[thread.peer.jobTitle, thread.peer.companyName].filter(Boolean).join(' · ') || 'Membre IN NETWORK'}</p>
        </div>
        {thread.peer.profileId && (
          <Link href={`/annuaire/${thread.peer.profileId}`} className="shrink-0 text-sm font-semibold text-brand-blue hover:underline">
            Voir le profil
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-brand-paper/60 px-4 py-5" data-lenis-prevent>
        {items.map((item, index) => {
          const previous = items[index - 1];
          const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
          return (
            <div key={item.id}>
              {newDay && (
                <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400">{formatDay(item.createdAt)}</p>
              )}
              <div className={cn('flex', item.fromMe ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft sm:max-w-[70%]',
                    item.fromMe ? 'rounded-br-md bg-ink-900 text-white' : 'rounded-bl-md bg-white text-ink-800',
                  )}
                >
                  {item.intro && (
                    <p className={cn('mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', item.fromMe ? 'text-white/70' : 'text-ink-400')}>
                      <Handshake className="h-3 w-3" /> Demande de mise en relation
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  <p className={cn('mt-1 text-right text-[10px]', item.fromMe ? 'text-white/60' : 'text-ink-400')}>
                    {formatTime(item.createdAt)}
                    {item.fromMe && !item.intro && 'readAt' in item && item.readAt ? ' · lu' : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-ink-900/8 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {error && (
          <p className="mb-2 text-xs text-brand-orange" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="message-draft" className="sr-only">
            Votre message
          </label>
          <textarea
            id="message-draft"
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Écrivez votre message…  (Entrée pour envoyer, Maj + Entrée pour un retour à la ligne)"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-ink-900/12 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-hidden placeholder:text-ink-400 focus:border-ink-900/40 focus:ring-2 focus:ring-ink-900/10"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim() || send.isPending} aria-label="Envoyer">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessagesView() {
  const params = useSearchParams();
  const activeId = params.get('c');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">Réseau</p>
        <h1 className="mt-1 font-heading text-2xl font-bold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-500">Échangez directement avec les membres dont vous avez accepté (ou qui ont accepté) la mise en relation.</p>
      </div>

      <div className="grid h-[calc(100dvh-15rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-soft lg:grid-cols-[320px_1fr]">
        <aside className={cn('min-h-0 overflow-y-auto border-ink-900/8 lg:border-r', activeId ? 'hidden lg:block' : 'block')} data-lenis-prevent>
          <ConversationList activeId={activeId} />
        </aside>
        <section className={cn('min-h-0', activeId ? 'block' : 'hidden lg:block')}>
          {activeId ? (
            <ThreadView key={activeId} id={activeId} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState icon={MessageCircle} title="Choisissez une conversation" description="Sélectionnez un membre dans la liste pour reprendre l’échange." className="border-0 bg-transparent py-0" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <MessagesView />
    </Suspense>
  );
}
