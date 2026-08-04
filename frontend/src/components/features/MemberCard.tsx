import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MemberTypeBadge, MEMBER_TYPE_ACCENT } from '@/components/ui/badge';
import type { MemberProfileSummary } from '@/types';

// Même traitement "portrait affirmé" qu'ExpertCard : gros avatar, hiérarchie
// resserrée, CTA hover — pour que la carte reste dense et vivante même
// quand les champs optionnels (poste, secteurs) sont vides, plutôt que de
// s'appuyer sur mt-auto pour combler le vide avec de l'espace mort.
export function MemberCard({ profile }: { profile: MemberProfileSummary }) {
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`;

  return (
    <Link href={`/annuaire/${profile.id}`} className="group block h-full">
      <Card accent={MEMBER_TYPE_ACCENT[profile.memberType] ?? 'none'} className="h-full">
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 to-brand-orange text-white">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-heading text-xl font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-lg font-bold text-ink-900">
                {profile.firstName} {profile.lastName}
              </p>
              {profile.jobTitle && <p className="mt-0.5 truncate text-sm font-medium text-brand-blue">{profile.jobTitle}</p>}
              {profile.companyName && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  <Building2 className="h-3 w-3 shrink-0" /> {profile.companyName}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <MemberTypeBadge memberType={profile.memberType} />
            {profile.sectors.slice(0, 2).map((sector) => (
              <span key={sector} className="rounded-pill bg-ink-900/[0.05] px-2.5 py-0.5 text-xs text-ink-600">
                {sector}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-end border-t border-dashed border-ink-900/10 pt-4">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-900 transition-transform duration-200 group-hover:translate-x-0.5">
              Voir le profil <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
