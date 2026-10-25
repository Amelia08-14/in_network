import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { ExpertCard } from '@/components/features/ExpertCard';
import { EmptyState } from '@/components/ui/empty-state';
import { serverGet } from '@/lib/server-api';
import type { ExpertSummary } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Nos experts' };

const EXPERTISE_LABELS = [
  'Entrepreneuriat',
  'Stratégie & croissance',
  'Finance',
  'Intelligence artificielle',
  'Ressources humaines',
  'Innovation',
];

export default async function ExpertsPage() {
  const experts = await serverGet<ExpertSummary[]>('/api/experts?limit=24', 3600, [], 'experts');

  return (
    <>
      <Container className="pb-6 pt-14 md:pt-20">
        <PageHeader
          eyebrow="Notre communauté"
          title="Nos experts"
          description="Rencontrez les spécialistes qui mettent leur expérience, leur réseau et leur savoir-faire au service de vos ambitions."
        />
      </Container>

      {/* Bandeau navy — les domaines d'expertise, défilant */}
      <div className="overflow-hidden bg-ink-900 py-3.5 text-white">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-1 px-5">
          {EXPERTISE_LABELS.map((label, index) => (
            <div key={label} className="flex items-center gap-7">
              <span className="whitespace-nowrap text-sm font-semibold">{label}</span>
              {index < EXPERTISE_LABELS.length - 1 && (
                <span aria-hidden className="text-lg font-light text-brand-orange">
                  ✦
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Section tone="paper">
        {experts.length === 0 ? (
          <EmptyState title="Aucun expert publié pour le moment" />
        ) : (
          <ScrollReveal stagger={70} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {experts.map((expert, index) => (
              <ExpertCard key={expert.id} expert={expert} featured={index === 0} />
            ))}
          </ScrollReveal>
        )}
      </Section>
    </>
  );
}
