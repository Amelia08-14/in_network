import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import type { ExpertSummary } from '@/types';

export function ExpertCard({ expert }: { expert: ExpertSummary }) {
  return (
    <Link href={`/experts/${expert.id}`} className="group block h-full">
      <Card accent="green" className="h-full">
        <CardContent className="flex h-full flex-col gap-2 pl-6">
          <div className="flex items-start gap-3">
            <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={44} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-heading font-bold text-ink-900">{expert.displayName}</p>
                {expert.isVerified && (
                  <Badge variant="expert" className="inline-flex shrink-0 items-center gap-1">
                    <BadgeCheck className="h-3 w-3" /> Vérifié
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm font-medium text-brand-blue">{expert.expertiseArea}</p>
            </div>
          </div>

          {expert.companyName && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              {expert.companyName}
            </p>
          )}
          {expert.bio && <p className="line-clamp-2 text-sm text-ink-600">{expert.bio}</p>}
          {expert.hourlyRate && (
            <p className="mt-auto text-sm text-ink-600">{expert.hourlyRate} DZD / heure</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
