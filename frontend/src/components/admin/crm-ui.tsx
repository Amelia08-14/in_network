'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HUE, type Hue } from '@/lib/palette';
import { api } from '@/lib/admin-api';
import { initials, INVOICE_STATUS, ORDER_STATUS, QUOTE_STATUS, staffName, STAGE_BY_VALUE, TONE_CLASS, type Tone } from '@/lib/crm';
import type { InvoiceStatus, LeadStage, OrderStatus, QuoteStatus, StaffUser } from '@/types/crm';

export function Pill({ tone = 'gray', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}

export const StageBadge = ({ stage }: { stage: LeadStage }) => <Pill tone={STAGE_BY_VALUE[stage].tone}>{STAGE_BY_VALUE[stage].label}</Pill>;
export const QuoteBadge = ({ status }: { status: QuoteStatus }) => <Pill tone={QUOTE_STATUS[status].tone}>{QUOTE_STATUS[status].label}</Pill>;
export const InvoiceBadge = ({ status }: { status: InvoiceStatus }) => <Pill tone={INVOICE_STATUS[status].tone}>{INVOICE_STATUS[status].label}</Pill>;
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Pill tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Pill>;

export function Avatar({ user, className }: { user: Pick<StaffUser, 'displayName' | 'email'> | null | undefined; className?: string }) {
  const name = staffName(user);
  return (
    <span
      title={name}
      className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white', !user && 'bg-ink-900/20 text-ink-500', className)}
    >
      {user ? initials(name) : '?'}
    </span>
  );
}

export function PageTitle({ title, description, actions, hue = 'orange' }: { title: string; description?: string; actions?: React.ReactNode; hue?: Hue }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <span aria-hidden className={cn('mb-2 block h-1 w-10 rounded-full', HUE[hue].solid)} />
        <h1 className="font-heading text-2xl font-bold text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// KPI : une teinte par sens (cf. lib/palette.ts) — bandeau à gauche, médaillon
// d'icône et fond doux. `tone="alert"` force l'orange (retards, impayés).
export function Kpi({ label, value, hint, href, tone, hue = 'ink', icon: Icon }: { label: string; value: string; hint?: string; href?: string; tone?: 'alert'; hue?: Hue; icon?: LucideIcon }) {
  const h = HUE[tone === 'alert' ? 'red' : hue];
  const body = (
    <div className={cn('relative h-full overflow-hidden rounded-2xl border bg-white p-4 pl-5 shadow-soft transition-shadow', tone === 'alert' ? 'border-red-300' : 'border-ink-900/8', href && 'hover:shadow-soft-lg')}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', h.solid)} />
      <span aria-hidden className={cn('pointer-events-none absolute inset-0', h.wash)} />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', h.soft, h.text)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn('relative mt-1.5 font-heading text-2xl font-bold tabular-nums text-ink-900', tone === 'alert' && 'text-red-700')}>{value}</p>
      {hint && <p className="relative mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-800">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Équipe commerciale (comptes staff) pour les listes d'assignation. */
export function useStaff(path = '/api/admin/crm/staff') {
  return useQuery({
    queryKey: ['crm-staff', path],
    queryFn: () => api.get<{ data: StaffUser[] }>(path).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function errorMessage(error: unknown, fallback = 'Une erreur est survenue.') {
  return error instanceof Error && error.message ? error.message : fallback;
}
