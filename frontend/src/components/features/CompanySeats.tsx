import type { ReactNode } from 'react';
import { CircleDashed, KeyRound, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CompanyMember } from '@/types';

// Les postes d'une entreprise multi-postes : un poste = un collaborateur avec
// son propre accès (identifiant = son e-mail). Partagé par la page admin
// « Entreprises », « Mon équipe » (représentant) et « Mon entreprise »
// (collaborateurs, sans le détail des accès).

const dateFr = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export const memberName = (m: CompanyMember) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

export function CompanySeats({
  members,
  seatLimit,
  showAccess = true,
  actions,
}: {
  members: CompanyMember[];
  seatLimit: number;
  /** Détail des accès (statut, e-mail confirmé, dernière connexion). */
  showAccess?: boolean;
  actions?: (member: CompanyMember) => ReactNode;
}) {
  const sorted = [...members].sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  const free = Math.max(0, seatLimit - sorted.length);

  return (
    <ol className="divide-y divide-ink-900/8">
      {sorted.map((m, index) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
          <span className="w-16 shrink-0 whitespace-nowrap font-heading text-xs font-bold uppercase tracking-[0.12em] text-ink-400">Poste {index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
              {memberName(m)}
              {m.isOwner && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-500">
                  <ShieldCheck className="h-3.5 w-3.5" /> Représentant
                </span>
              )}
            </p>
            <p className="truncate text-sm text-ink-500">
              {m.jobTitle ? `${m.jobTitle} · ` : ''}
              {m.email}
            </p>
            {showAccess && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Identifiant : {m.email}
                </span>
                <span>{m.emailVerified ? 'E-mail confirmé' : 'E-mail non confirmé'}</span>
                <span>{m.lastLoginAt ? `Dernière connexion le ${dateFr(m.lastLoginAt)}` : 'Jamais connecté'}</span>
                {m.phone && <span>{m.phone}</span>}
              </p>
            )}
          </div>
          {showAccess && (
            <Badge variant={m.isActive ? 'success' : 'neutral'}>{m.isActive ? 'Accès actif' : 'Accès coupé'}</Badge>
          )}
          {actions?.(m)}
        </li>
      ))}
      {Array.from({ length: free }, (_, i) => (
        <li key={`free-${i}`} className="flex items-center gap-4 px-5 py-3 text-sm text-ink-400">
          <span className="w-16 shrink-0 whitespace-nowrap font-heading text-xs font-bold uppercase tracking-[0.12em]">Poste {sorted.length + i + 1}</span>
          <span className="inline-flex items-center gap-1.5">
            <CircleDashed className="h-3.5 w-3.5" /> Poste libre
          </span>
        </li>
      ))}
    </ol>
  );
}
