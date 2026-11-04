import type { RefObject } from 'react';
import { cn } from '@/lib/utils';

// Fil de la messagerie membre ↔ équipe, partagé par l'espace membre et le
// backoffice : bulles à droite pour soi, à gauche pour l'autre partie, nom du
// membre de l'équipe qui répond, séparateurs de jour.

export interface SupportMessage {
  id: string;
  body: string;
  createdAt: string;
  fromStaff: boolean;
  fromMe: boolean;
  author: string | null;
}

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Aujourd’hui';
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShort(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? formatTime(iso) : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function MessageBubbles({ messages, bottomRef, memberName }: { messages: SupportMessage[]; bottomRef: RefObject<HTMLDivElement | null>; memberName?: string }) {
  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-brand-paper/60 px-4 py-5" data-lenis-prevent>
      {messages.map((m, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
        const author = m.fromStaff ? m.author : memberName;
        return (
          <div key={m.id}>
            {newDay && <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400">{formatDay(m.createdAt)}</p>}
            <div className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft sm:max-w-[70%]', m.fromMe ? 'rounded-br-md bg-ink-900 text-white' : 'rounded-bl-md bg-white text-ink-800')}>
                {author && <p className={cn('mb-0.5 text-[11px] font-semibold', m.fromMe ? 'text-white/70' : 'text-brand-orange')}>{author}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-right text-[10px]', m.fromMe ? 'text-white/60' : 'text-ink-400')}>{formatTime(m.createdAt)}</p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
