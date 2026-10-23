'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HUE, type Hue } from '@/lib/palette';
import { api } from '@/lib/admin-api';
import {
  CIRCUIT,
  COMMISSION_STATUS,
  initials,
  INVOICE_STATUS,
  KIND,
  MEMBER_SERVICE_STATUS,
  ORDER_STATUS,
  POLE,
  PRIORITY,
  QUOTE_STATUS,
  SALES_PROFILE_LABEL,
  SALES_ROLES,
  stageLabel,
  staffName,
  STAGE_BY_VALUE,
  TONE_CLASS,
  type Tone,
} from '@/lib/crm';
import { useAdminAuthStore } from '@/store/admin-auth';
import type {
  CommissionStatus,
  DeliveryPole,
  InvoiceStatus,
  LeadCircuit,
  LeadKind,
  LeadPriority,
  LeadStage,
  MemberServiceStatus,
  OrderStatus,
  QuoteStatus,
  StaffUser,
} from '@/types/crm';

export function Pill({ tone = 'gray', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}

export const StageBadge = ({ stage, circuit }: { stage: LeadStage; circuit?: LeadCircuit | null }) => (
  <Pill tone={stage === 'REGISTERED' && !circuit ? 'orange' : STAGE_BY_VALUE[stage].tone}>{stageLabel(stage, circuit)}</Pill>
);
export const CircuitBadge = ({ circuit }: { circuit: LeadCircuit | null | undefined }) =>
  circuit ? <Pill tone={CIRCUIT[circuit].tone}>{CIRCUIT[circuit].short}</Pill> : <Pill tone="orange">À aiguiller</Pill>;
export const KindBadge = ({ kind }: { kind: LeadKind }) => (kind === 'NEW_BUSINESS' ? null : <Pill tone={KIND[kind].tone}>{KIND[kind].label}</Pill>);
export const PoleBadge = ({ pole }: { pole: DeliveryPole }) => <Pill tone={POLE[pole].tone}>{POLE[pole].label}</Pill>;
export const MemberServiceBadge = ({ status }: { status: MemberServiceStatus }) => <Pill tone={MEMBER_SERVICE_STATUS[status].tone}>{MEMBER_SERVICE_STATUS[status].label}</Pill>;
export const CommissionBadge = ({ status }: { status: CommissionStatus }) => <Pill tone={COMMISSION_STATUS[status].tone}>{COMMISSION_STATUS[status].label}</Pill>;
export const PriorityBadge = ({ priority }: { priority: LeadPriority | null | undefined }) =>
  priority ? <Pill tone={PRIORITY[priority].tone}>{PRIORITY[priority].label}</Pill> : null;
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

/**
 * Rôle du compte connecté dans le processus (calculé par l'API, appliqué aussi
 * côté serveur) : sert à n'afficher que les actions qui lui reviennent.
 */
export function useCrmAccess() {
  const user = useAdminAuthStore((s) => s.user);
  const access = user?.crmAccess;
  return {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    allLeads: Boolean(access?.allLeads),
    manageLeads: Boolean(access?.manageLeads),
    salesManager: Boolean(access?.salesManager),
    officeManager: Boolean(access?.officeManager),
    direction: Boolean(access?.direction),
  };
}

const agentLabel = (u: StaffUser) =>
  `${staffName(u)}${u.role === 'SALES_MANAGER' ? ' (responsable)' : u.salesProfile ? ` (${SALES_PROFILE_LABEL[u.salesProfile]})` : ''}${u.isExternal ? ' · prestataire' : ''}`;

/** Options d'attribution d'un lead du circuit 1 : les commerciaux, sédentaires puis terrain. */
export function SalesAgentOptions({ staff }: { staff: StaffUser[] | undefined }) {
  const team = (staff ?? []).filter((u) => SALES_ROLES.includes(u.role ?? ''));
  const group = (label: string, list: StaffUser[]) =>
    list.length > 0 && (
      <optgroup label={label}>
        {list.map((u) => (
          <option key={u.id} value={u.id}>
            {agentLabel(u)}
          </option>
        ))}
      </optgroup>
    );
  return (
    <>
      {group('Sédentaires (distance, digital, diaspora)', team.filter((u) => u.salesProfile === 'SEDENTARY'))}
      {group('Terrain (entreprises, rendez-vous)', team.filter((u) => u.salesProfile === 'FIELD'))}
      {group('Équipe commerciale', team.filter((u) => !u.salesProfile))}
    </>
  );
}

/** Office Managers (destinataires d'un dossier transmis ou d'un lead du circuit 2). */
export function OfficeManagerOptions({ staff }: { staff: StaffUser[] | undefined }) {
  return (
    <>
      {(staff ?? [])
        .filter((u) => u.role === 'OFFICE_MANAGER')
        .map((u) => (
          <option key={u.id} value={u.id}>
            {staffName(u)}
          </option>
        ))}
    </>
  );
}

/** Options d'une liste d'intervenants : l'équipe commerciale d'abord, puis les autres comptes. */
export function AssigneeOptions({ staff }: { staff: StaffUser[] | undefined }) {
  const team = (staff ?? []).filter((u) => SALES_ROLES.includes(u.role ?? ''));
  const others = (staff ?? []).filter((u) => !SALES_ROLES.includes(u.role ?? ''));
  const render = (list: StaffUser[]) =>
    list.map((u) => (
      <option key={u.id} value={u.id}>
        {agentLabel(u)}
      </option>
    ));
  return (
    <>
      {team.length > 0 && <optgroup label="Équipe commerciale">{render(team)}</optgroup>}
      {others.length > 0 && <optgroup label="Autres comptes">{render(others)}</optgroup>}
    </>
  );
}

/** Bandeau d'erreur d'une action. */
export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-brand-orange/10 px-4 py-2.5 text-sm text-brand-orange" role="alert">
      {message}
    </p>
  );
}
