'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Client {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
}

// Page ouverte au clic quand la notification ne porte pas de lien précis.
const FALLBACK: Record<'admin' | 'member', [prefix: string, href: string][]> = {
  admin: [
    ['lead_new', '/admin/crm/entrants'],
    ['lead_', '/admin/crm/pipeline'],
    ['quote_', '/admin/devis'],
    ['invoice_', '/admin/factures'],
    ['payment_proof', '/admin/factures'],
  ],
  member: [
    ['new_message', '/dashboard/messages'],
    ['connection_', '/dashboard/networking'],
    ['booking_', '/dashboard/reservations'],
    ['account_', '/dashboard'],
    ['payment_proof', '/dashboard/situation'],
  ],
};

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/**
 * Cloche de notifications : nouveaux leads à qualifier, leads assignés, messages,
 * mises en relation… Actualisée toutes les 20 s. Un clic ouvre la page concernée.
 */
export function NotificationBell({ client, scope, className }: { client: Client; scope: 'admin' | 'member'; className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const key = ['notifications', scope];

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => client.get<{ data: { unread: number; items: NotificationItem[] } }>('/api/notifications').then((r) => r.data),
    refetchInterval: 20_000,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => client.post(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const markAll = useMutation({
    mutationFn: () => client.post('/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openItem(item: NotificationItem) {
    if (!item.isRead) markRead.mutate(item.id);
    const target = item.href ?? FALLBACK[scope].find(([prefix]) => item.type.startsWith(prefix))?.[1];
    setOpen(false);
    if (target) router.push(target);
  }

  const unread = data?.unread ?? 0;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-700 transition-colors hover:bg-ink-900/5"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-soft-lg md:left-auto md:right-0 md:max-lg:left-0">
          <div className="flex items-center justify-between border-b border-ink-900/8 px-4 py-3">
            <p className="font-heading text-sm font-bold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markAll.mutate()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-blue/5">
                <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <ul className="max-h-[26rem] divide-y divide-ink-900/8 overflow-y-auto" data-lenis-prevent>
            {!data || data.items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-500">Aucune notification pour le moment.</li>
            ) : (
              data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-900/[0.04]', !item.isRead && 'bg-brand-orange/[0.05]')}
                  >
                    <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.isRead ? 'bg-transparent' : 'bg-brand-orange')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm text-ink-900', !item.isRead && 'font-semibold')}>{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-600">{item.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-400">{timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
