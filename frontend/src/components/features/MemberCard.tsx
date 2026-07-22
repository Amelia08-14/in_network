import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MemberTypeBadge, MEMBER_TYPE_ACCENT } from '@/components/ui/badge';
import type { MemberProfileSummary } from '@/types';

export function MemberCard({ profile }: { profile: MemberProfileSummary }) {
  return (
    <Link href={`/annuaire/${profile.id}`} className="group block h-full">
      <Card accent={MEMBER_TYPE_ACCENT[profile.memberType] ?? 'none'} className="h-full">
        <CardContent className="flex h-full flex-col gap-3 pl-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-900/[0.06] text-ink-900">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-heading text-lg font-bold">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </span>
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="truncate font-heading font-bold text-ink-900">
                {profile.firstName} {profile.lastName}
              </p>
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

          {profile.jobTitle && <p className="mt-auto text-sm text-ink-600">{profile.jobTitle}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
