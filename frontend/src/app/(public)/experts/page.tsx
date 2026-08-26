import { Container } from '@/components/ui/container';
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
      <section className="relative overflow-hidden border-b border-ink-900/6 bg-white/45 py-14 md:py-20">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-42 border-brand-orange/[0.07]"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border-38 border-brand-blue/5"
        />
        <Container className="relative text-center">
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
            <span className="h-2 w-2 rounded-full bg-brand-orange" />
            Notre communauté
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-ink-900 md:text-6xl">
            Nos experts
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-500 md:text-lg">
            Rencontrez les spécialistes qui mettent leur expérience, leur réseau et
            leur savoir-faire au service de vos ambitions.
          </p>
        </Container>
      </section>

      <div className="overflow-hidden bg-ink-900 py-4 text-white">
        <div className="mx-auto flex min-w-max items-center justify-center gap-7 px-5">
          {EXPERTISE_LABELS.map((label, index) => (
            <div key={label} className="flex items-center gap-7">
              <span className="whitespace-nowrap text-sm font-semibold md:text-base">{label}</span>
              {index < EXPERTISE_LABELS.length - 1 && (
                <span aria-hidden className="text-xl font-light text-brand-orange">✦</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Container className="py-16 md:py-24">
        <div className="mb-10 text-center md:mb-14">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-600">
            <span className="flex gap-0.5" aria-hidden>
              <span className="h-3 w-2 rounded-full bg-brand-orange" />
              <span className="h-3 w-2 rounded-full bg-ink-900" />
            </span>
            Notre équipe
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Rencontrez nos experts
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-500">
            Des profils complémentaires, réunis par la volonté de partager et de faire grandir.
          </p>
        </div>

        {experts.length === 0 ? (
          <EmptyState title="Aucun expert publié pour le moment" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {experts.map((expert, index) => (
              <ExpertCard key={expert.id} expert={expert} featured={index === 0} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
