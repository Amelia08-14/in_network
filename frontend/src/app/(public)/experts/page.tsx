import { Container } from '@/components/ui/container';
import { ExpertCard } from '@/components/features/ExpertCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import type { ExpertSummary } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Experts & partenaires' };

export default async function ExpertsPage() {
  const experts = await serverGet<ExpertSummary[]>('/api/experts?limit=24', 3600, []);

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Experts"
        title={<>Experts &amp; <span className="text-brand-orange">partenaires</span></>}
        description="Des experts vérifiés pour t'accompagner : comptabilité, juridique, marketing et plus encore."
      />

      {experts.length === 0 ? (
        <EmptyState title="Aucun expert publié pour le moment" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))}
        </div>
      )}
    </Container>
  );
}
