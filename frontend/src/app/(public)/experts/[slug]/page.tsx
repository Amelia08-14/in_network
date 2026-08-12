import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { ExpertConnectionRequest } from '@/components/features/ExpertConnectionRequest';
import { serverGet } from '@/lib/server-api';
import type { ExpertSummary } from '@/types';

export const revalidate = 3600;

export default async function ExpertDetailPage({ params }: { params: { slug: string } }) {
  const expert = await serverGet<ExpertSummary | null>(`/api/experts/${params.slug}`, 3600, null, 'experts');
  if (!expert) notFound();

  return (
    <Container className="section-padding max-w-3xl">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={140} className="rounded-3xl shrink-0" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold text-ink-900">{expert.displayName}</h1>
            {expert.isVerified && (
              <Badge variant="expert" className="inline-flex shrink-0 items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5" /> Vérifié
              </Badge>
            )}
          </div>
          <p className="mt-1 text-lg font-medium text-brand-blue">{expert.expertiseArea}</p>
          {expert.companyName && <p className="mt-1 text-ink-500">{expert.companyName}</p>}
        </div>
      </div>
      {expert.bio && <p className="mt-6 whitespace-pre-line text-ink-600">{expert.bio}</p>}

      {expert.servicesOffered?.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-ink-500">
            Services proposés
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {expert.servicesOffered.map((s) => (
              <Badge key={s} variant="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {expert.hourlyRate && (
        <p className="mt-6 font-heading text-2xl font-bold text-brand-orange">{expert.hourlyRate} DZD / heure</p>
      )}

      <div className="mt-8">
        <ExpertConnectionRequest expertId={expert.id} expertName={expert.displayName} />
      </div>
    </Container>
  );
}
