'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Headset, MessageSquarePlus, Send } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatShort, MessageBubbles, type SupportMessage } from '@/components/features/SupportChat';

// Messagerie avec l'équipe IN NETWORK (demande cliente 04/11/2026) : le membre
// choisit le service à qui il écrit (office manager, administration, service
// commercial) ; seul ce service reçoit la conversation dans le backoffice.

interface Department {
  key: string;
  label: string;
  description: string;
}
interface ThreadSummary {
  id: string;
  departmentLabel: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  lastMessageAt: string;
  lastMessage: { body: string; fromMe: boolean } | null;
  unread: boolean;
}
interface Thread {
  id: string;
  departmentLabel: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  messages: SupportMessage[];
}

const errorText = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Message non envoyé. Vérifiez votre connexion puis réessayez.');

function ThreadList({ activeId }: { activeId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['support-threads'],
    queryFn: () => api.get<{ data: ThreadSummary[] }>('/api/support/threads').then((r) => r.data),
    refetchInterval: 15_000,
  });
  if (isLoading) return <p className="p-5 text-sm text-ink-500">Chargement…</p>;
  if (!data?.length) return <p className="p-5 text-sm text-ink-500">Aucune conversation pour le moment.</p>;
  return (
    <ul className="divide-y divide-ink-900/8">
      {data.map((t) => (
        <li key={t.id}>
          <Link
            href={`/dashboard/equipe-in-network?t=${t.id}`}
            aria-current={t.id === activeId ? 'page' : undefined}
            className={cn('block px-4 py-3.5 transition-colors hover:bg-ink-900/[0.03]', t.id === activeId && 'bg-ink-900/[0.05]')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-orange">{t.departmentLabel}</span>
              <span className="shrink-0 text-[11px] text-ink-400">{formatShort(t.lastMessageAt)}</span>
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2">
              <span className={cn('truncate text-sm text-ink-900', t.unread ? 'font-bold' : 'font-semibold')}>{t.subject}</span>
              {t.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-orange" aria-label="Nouvelle réponse" />}
            </span>
            {t.lastMessage && (
              <span className="mt-0.5 block truncate text-sm text-ink-500">
                {t.lastMessage.fromMe ? 'Vous : ' : ''}
                {t.lastMessage.body}
              </span>
            )}
            {t.status === 'CLOSED' && <span className="mt-1 inline-block rounded-pill bg-ink-900/[0.06] px-2 py-0.5 text-[11px] text-ink-500">Close</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewThread({ onCreated }: { onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data: departments = [] } = useQuery({
    queryKey: ['support-departments'],
    queryFn: () => api.get<{ data: Department[] }>('/api/support/departments').then((r) => r.data),
    staleTime: Infinity,
  });
  const [department, setDepartment] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/support/threads', { department, subject, body }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['support-threads'] });
      onCreated(res.data.id);
    },
    onError: (e) => setError(errorText(e)),
  });

  return (
    <form
      className="space-y-5 p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!department) return setError('Choisissez le service à qui vous écrivez.');
        create.mutate();
      }}
    >
      <div>
        <p className="font-heading text-lg font-bold text-ink-900">Nouveau message</p>
        <p className="text-sm text-ink-500">Choisissez le service concerné : votre message lui est transmis directement.</p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">À qui écrivez-vous ?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {departments.map((d) => (
            <label
              key={d.key}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                department === d.key ? 'border-brand-orange bg-brand-orange/[0.06] ring-1 ring-brand-orange' : 'border-ink-900/12 hover:border-ink-900/25',
              )}
            >
              <input type="radio" name="department" value={d.key} checked={department === d.key} onChange={() => setDepartment(d.key)} className="sr-only" />
              <span className={cn('text-sm font-bold', department === d.key ? 'text-brand-orange' : 'text-ink-900')}>{d.label}</span>
              <span className="text-xs leading-snug text-ink-500">{d.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="support-subject">Objet</Label>
        <Input id="support-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex. Accès au bureau le week-end, question sur ma facture…" />
      </div>
      <div>
        <Label htmlFor="support-body">Message</Label>
        <textarea
          id="support-body"
          rows={5}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-y rounded-xl border border-ink-900/12 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-hidden placeholder:text-ink-400 focus:border-ink-900/40 focus:ring-2 focus:ring-ink-900/10"
        />
      </div>
      {error && (
        <p className="text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={create.isPending || !subject.trim() || !body.trim()}>
        <Send className="h-4 w-4" /> {create.isPending ? 'Envoi…' : 'Envoyer'}
      </Button>
    </form>
  );
}

function ThreadView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading, isError } = useQuery({
    queryKey: ['support-thread', id],
    queryFn: () => api.get<{ data: Thread }>(`/api/support/threads/${id}`).then((r) => r.data),
    refetchInterval: 5_000,
  });
  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    if (!thread) return;
    queryClient.invalidateQueries({ queryKey: ['support-unread'] });
    queryClient.invalidateQueries({ queryKey: ['support-threads'] });
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [count, thread, queryClient]);

  const send = useMutation({
    mutationFn: (body: string) => api.post(`/api/support/threads/${id}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['support-thread', id] });
      queryClient.invalidateQueries({ queryKey: ['support-threads'] });
    },
    onError: (e) => setError(errorText(e)),
  });
  const submit = () => draft.trim() && !send.isPending && send.mutate(draft.trim());

  if (isLoading) return <p className="p-6 text-sm text-ink-500">Chargement…</p>;
  if (isError || !thread) return <EmptyState title="Conversation introuvable" className="m-6 py-10" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-900/8 px-4 py-3">
        <button type="button" onClick={() => router.push('/dashboard/equipe-in-network')} className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/5 lg:hidden" aria-label="Retour aux conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white">
          <Headset className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold text-ink-900">{thread.subject}</p>
          <p className="truncate text-xs text-ink-500">
            {thread.departmentLabel} · Équipe IN NETWORK{thread.status === 'CLOSED' ? ' · conversation close (un nouveau message la rouvre)' : ''}
          </p>
        </div>
      </header>
      <MessageBubbles messages={thread.messages} bottomRef={bottomRef} />
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
          <label htmlFor="support-draft" className="sr-only">
            Votre message
          </label>
          <textarea
            id="support-draft"
            rows={1}
            maxLength={4000}
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

function SupportView() {
  const params = useSearchParams();
  const router = useRouter();
  const activeId = params.get('t');
  const composing = params.get('nouveau') !== null;
  const open = Boolean(activeId) || composing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">Assistance</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-ink-900">Équipe IN NETWORK</h1>
          <p className="mt-1 text-sm text-ink-500">Écrivez à l’office manager, à l’administration ou au service commercial : la bonne personne vous répond ici.</p>
        </div>
        <Button variant="primary" onClick={() => router.push('/dashboard/equipe-in-network?nouveau')}>
          <MessageSquarePlus className="h-4 w-4" /> Nouveau message
        </Button>
      </div>

      <div className="grid h-[calc(100dvh-15rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-soft lg:grid-cols-[320px_1fr]">
        <aside className={cn('min-h-0 overflow-y-auto border-ink-900/8 lg:border-r', open ? 'hidden lg:block' : 'block')} data-lenis-prevent>
          <ThreadList activeId={activeId} />
        </aside>
        <section className={cn('min-h-0 overflow-y-auto', open ? 'block' : 'hidden lg:block')} data-lenis-prevent>
          {composing ? (
            <NewThread onCreated={(id) => router.push(`/dashboard/equipe-in-network?t=${id}`)} />
          ) : activeId ? (
            <ThreadView key={activeId} id={activeId} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={Headset}
                title="Une question ? L’équipe est là."
                description="Choisissez une conversation, ou écrivez un nouveau message au service concerné."
                className="border-0 bg-transparent py-0"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function EquipeInNetworkPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <SupportView />
    </Suspense>
  );
}
