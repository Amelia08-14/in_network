import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { serverGet } from '@/lib/server-api';
import type { ExpertSummary } from '@/types';

export const revalidate = 3600;

export default async function ExpertDetailPage({ params }: { params: { slug: string } }) {
  const expert = await serverGet<ExpertSummary | null>(`/api/experts/${params.slug}`, 3600, null);
  if (!expert) notFound();

  return (
    <Container className="section-padding max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={72} />
          <div>
            <h1 className="font-heading text-3xl font-bold text-ink-900">{expert.displayName}</h1>
            <p className="mt-1 text-lg font-medium text-brand-blue">{expert.expertiseArea}</p>
          </div>
        </div>
        {expert.isVerified && (
          <Badge variant="expert" className="inline-flex shrink-0 items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> Vérifié
          </Badge>
        )}
      </div>

      {expert.companyName && <p className="mt-2 text-ink-500">{expert.companyName}</p>}
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
        <Button variant="primary" size="lg">
          Demander une mise en relation
        </Button>
        <p className="mt-2 text-xs text-ink-500">Connecte-toi pour envoyer une demande à cet expert.</p>
      </div>
    </Container>
  );
}
