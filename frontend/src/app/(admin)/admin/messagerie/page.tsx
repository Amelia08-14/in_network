'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Inbox, MessageSquarePlus, RotateCcw, Search, Send, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { api, ApiRequestError } from '@/lib/admin-api';
import { cn } from '@/lib/utils';
import { formatShort, MessageBubbles, type SupportMessage } from '@/components/features/SupportChat';

// Messagerie avec les membres (demande cliente 04/11/2026). Chaque compte ne
// reçoit que les conversations de son service (office manager, administration,
// commercial) ; la Direction voit tout et peut filtrer par service.

interface Member {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  avatarUrl: string | null;
}
interface ThreadSummary {
  id: string;
  department: string;
  departmentLabel: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  lastMessageAt: string;
  member: Member;
  lastMessage: { body: string; fromStaff: boolean } | null;
  unread: boolean;
}
interface ThreadList {
  departments: { key: string; label: string }[];
  threads: ThreadSummary[];
}
interface Thread {
  id: string;
  department: string;
  departmentLabel: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  member: Member;
  messages: SupportMessage[];
}

const errorText = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Action impossible, réessayez.');
const STATUS_TABS = [
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'CLOSED', label: 'Closes' },
  { value: '', label: 'Toutes' },
] as const;

function useThreadList(department: string, status: string, search: string) {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());
  return useQuery({
    queryKey: ['admin-support-threads', department, status, search.trim()],
    queryFn: () => api.get<{ data: ThreadList }>(`/api/admin/support/threads?${params.toString()}`).then((r) => r.data),
    refetchInterval: 15_000,
  });
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading, isError } = useQuery({
    queryKey: ['admin-support-thread', id],
    queryFn: () => api.get<{ data: Thread }>(`/api/admin/support/threads/${id}`).then((r) => r.data),
    refetchInterval: 5_000,
  });
  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    if (!thread) return;
    queryClient.invalidateQueries({ queryKey: ['admin-support-unread'] });
    queryClient.invalidateQueries({ queryKey: ['admin-support-threads'] });
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [count, thread, queryClient]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-support-thread', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-support-threads'] });
  };
  const send = useMutation({
    mutationFn: (body: string) => api.post(`/api/admin/support/threads/${id}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      setError(null);
      refresh();
    },
    onError: (e) => setError(errorText(e)),
  });
  const toggle = useMutation({
    mutationFn: (status: 'OPEN' | 'CLOSED') => api.patch(`/api/admin/support/threads/${id}`, { status }),
    onSuccess: refresh,
    onError: (e) => setError(errorText(e)),
  });
  const submit = () => draft.trim() && !send.isPending && send.mutate(draft.trim());

  if (isLoading) return <p className="p-6 text-sm text-ink-500">Chargement…</p>;
  if (isError || !thread) return <EmptyState title="Conversation introuvable" description="Elle n’existe plus ou ne relève pas de votre service." className="m-6 py-10" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-ink-900/8 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/5 lg:hidden" aria-label="Retour aux conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <AvatarPlaceholder name={thread.member.name} photoUrl={thread.member.avatarUrl} size={40} className="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold text-ink-900">{thread.subject}</p>
          <p className="truncate text-xs text-ink-500">
            {thread.member.name}
            {thread.member.companyName ? ` · ${thread.member.companyName}` : ''} · {thread.departmentLabel}
          </p>
        </div>
        <Link href={`/admin/membres/${thread.member.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
          <UserRound className="h-4 w-4" /> Fiche membre
        </Link>
        <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(thread.status === 'OPEN' ? 'CLOSED' : 'OPEN')}>
          {thread.status === 'OPEN' ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Clore
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" /> Rouvrir
            </>
          )}
        </Button>
      </header>
      <MessageBubbles messages={thread.messages} bottomRef={bottomRef} memberName={thread.member.name} />
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
          <label htmlFor="admin-support-draft" className="sr-only">
            Votre réponse
          </label>
          <textarea
            id="admin-support-draft"
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
            placeholder="Répondre au membre…  (il est prévenu par notification et par e-mail)"
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

function NewThread({ departments, preset, onCreated }: { departments: { key: string; label: string }[]; preset: Member | null; onCreated: (id: string) => void }) {
  const [member, setMember] = useState<Member | null>(preset);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState(departments.length === 1 ? departments[0].key : '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: results = [] } = useQuery({
    queryKey: ['admin-support-members', query.trim()],
    queryFn: () => api.get<{ data: Member[] }>(`/api/admin/support/members?q=${encodeURIComponent(query.trim())}`).then((r) => r.data),
    enabled: !member && query.trim().length >= 2,
  });

  const create = useMutation({
    mutationFn: () => api.post<{ data: { id: string } }>('/api/admin/support/threads', { memberId: member!.id, department, subject, body }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-threads'] });
      onCreated(res.data.id);
    },
    onError: (e) => setError(errorText(e)),
  });

  return (
    <form
      className="space-y-4 p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!member) return setError('Choisissez le membre.');
        if (!department) return setError('Choisissez le service qui écrit.');
        create.mutate();
      }}
    >
      <p className="font-heading text-lg font-bold text-ink-900">Écrire à un membre</p>
      <div>
        <Label htmlFor="support-member">Membre</Label>
        {member ? (
          <div className="flex items-center gap-3 rounded-xl border border-ink-900/12 px-3 py-2">
            <AvatarPlaceholder name={member.name} photoUrl={member.avatarUrl} size={32} className="rounded-full" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-semibold text-ink-900">{member.name}</span>
              <span className="block truncate text-ink-500">{member.email}</span>
            </span>
            <button type="button" className="text-sm font-semibold text-brand-blue hover:underline" onClick={() => setMember(null)}>
              Changer
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input id="support-member" className="pl-9" placeholder="Nom, e-mail ou entreprise…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {results.length > 0 && (
              <ul className="absolute inset-x-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-ink-900/12 bg-white py-1 shadow-soft-lg">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setMember(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-ink-900/[0.05]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink-900">{r.name}</span>
                        <span className="block truncate text-ink-500">
                          {r.email}
                          {r.companyName ? ` · ${r.companyName}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {departments.length > 1 && (
        <div>
          <Label htmlFor="support-dept">Au nom du service</Label>
          <select
            id="support-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="flex h-11 w-full rounded-card border border-ink-900/15 bg-white px-3 py-2 text-sm text-ink-900"
          >
            <option value="">Choisir…</option>
            {departments.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label htmlFor="support-new-subject">Objet</Label>
        <Input id="support-new-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="support-new-body">Message</Label>
        <textarea
          id="support-new-body"
          rows={5}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-y rounded-xl border border-ink-900/12 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-hidden focus:border-ink-900/40 focus:ring-2 focus:ring-ink-900/10"
        />
      </div>
      {error && (
        <p className="text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={create.isPending || !subject.trim() || !body.trim()}>
        <Send className="h-4 w-4" /> {create.isPending ? 'Envoi…' : 'Envoyer au membre'}
      </Button>
    </form>
  );
}

function MessagerieView() {
  const params = useSearchParams();
  const router = useRouter();
  const activeId = params.get('t');
  // Depuis la fiche membre : /admin/messagerie?membre=<id>&nom=<nom>&email=<e-mail>
  const presetId = params.get('membre');
  const preset: Member | null = presetId ? { id: presetId, name: params.get('nom') ?? 'Membre', email: params.get('email') ?? '', companyName: null, avatarUrl: null } : null;
  const composing = params.get('nouveau') !== null || Boolean(preset);
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState<string>('OPEN');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useThreadList(department, status, search);
  const departments = data?.departments ?? [];
  const open = Boolean(activeId) || composing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink-900">Messagerie membres</h1>
          <p className="mt-1 text-sm text-ink-500">
            {departments.length > 1 ? 'Toutes les conversations, par service.' : `Les conversations adressées au service ${departments[0]?.label ?? ''}.`} Les membres sont prévenus de vos réponses par notification et par e-mail.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/admin/messagerie?nouveau')}>
          <MessageSquarePlus className="h-4 w-4" /> Écrire à un membre
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {departments.length > 1 && (
          <>
            {[{ key: '', label: 'Tous les services' }, ...departments].map((d) => (
              <button
                key={d.key || 'all'}
                type="button"
                onClick={() => setDepartment(d.key)}
                aria-pressed={department === d.key}
                className={cn('rounded-pill border px-3 py-1.5 text-sm font-semibold', department === d.key ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/12 bg-white text-ink-700 hover:bg-ink-900/5')}
              >
                {d.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-ink-900/12" aria-hidden />
          </>
        )}
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setStatus(tab.value)}
            aria-pressed={status === tab.value}
            className={cn('rounded-pill border px-3 py-1.5 text-sm font-semibold', status === tab.value ? 'border-brand-orange bg-brand-orange text-white' : 'border-ink-900/12 bg-white text-ink-700 hover:bg-ink-900/5')}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Membre, entreprise, objet…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid h-[calc(100dvh-17rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-soft lg:grid-cols-[340px_1fr]">
        <aside className={cn('min-h-0 overflow-y-auto border-ink-900/8 lg:border-r', open ? 'hidden lg:block' : 'block')}>
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement…</p>
          ) : !data?.threads.length ? (
            <p className="p-5 text-sm text-ink-500">Aucune conversation.</p>
          ) : (
            <ul className="divide-y divide-ink-900/8">
              {data.threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/messagerie?t=${t.id}`}
                    aria-current={t.id === activeId ? 'page' : undefined}
                    className={cn('flex gap-3 px-4 py-3.5 transition-colors hover:bg-ink-900/[0.03]', t.id === activeId && 'bg-ink-900/[0.05]')}
                  >
                    <AvatarPlaceholder name={t.member.name} photoUrl={t.member.avatarUrl} size={40} className="rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-sm text-ink-900', t.unread ? 'font-bold' : 'font-semibold')}>{t.member.name}</span>
                        <span className="shrink-0 text-[11px] text-ink-400">{formatShort(t.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', t.unread ? 'font-semibold text-ink-800' : 'text-ink-600')}>{t.subject}</span>
                        {t.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-orange" aria-label="Non lu" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-500">
                        <span className="font-semibold text-brand-orange">{t.departmentLabel}</span>
                        {t.lastMessage ? ` · ${t.lastMessage.fromStaff ? 'Équipe : ' : ''}${t.lastMessage.body}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className={cn('min-h-0 overflow-y-auto', open ? 'block' : 'hidden lg:block')}>
          {composing ? (
            departments.length ? (
              <NewThread key={presetId ?? 'new'} departments={departments} preset={preset} onCreated={(id) => router.push(`/admin/messagerie?t=${id}`)} />
            ) : (
              <p className="p-6 text-sm text-ink-500">Chargement…</p>
            )
          ) : activeId ? (
            <ThreadView key={activeId} id={activeId} onBack={() => router.push('/admin/messagerie')} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState icon={Inbox} title="Choisissez une conversation" description="Les nouveaux messages des membres de votre service arrivent ici." className="border-0 bg-transparent py-0" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminMessageriePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Chargement…</p>}>
      <MessagerieView />
    </Suspense>
  );
}
