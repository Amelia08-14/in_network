import Link from 'next/link';
import { Images } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { EventCard } from '@/components/features/EventCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonVariants } from '@/components/ui/button';
import { EVENT_ORIGIN_LABEL } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { serverGet } from '@/lib/server-api';
import type { EventItem, EventOrigin } from '@/types';

export const revalidate = 900;
export const metadata = { title: 'Événements' };

const TABS: { label: string; value: EventOrigin | undefined }[] = [
  { label: 'Tous', value: undefined },
  { label: EVENT_ORIGIN_LABEL.IN_EVENT, value: 'IN_EVENT' },
  { label: EVENT_ORIGIN_LABEL.EXTERNAL, value: 'EXTERNAL' },
  { label: EVENT_ORIGIN_LABEL.CO_ORGANIZED, value: 'CO_ORGANIZED' },
];

export default async function EvenementsPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const { origin } = await searchParams;
  const activeOrigin = TABS.find((t) => t.value === origin)?.value;
  const query = activeOrigin ? `?origin=${activeOrigin}` : '';
  const events = await serverGet<EventItem[]>(`/api/events${query}`, 900, [], 'events');

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Agenda"
        title="Événements"
        description="Conférences, ateliers et rencontres networking : organisés en interne (IN EVENT), relayés depuis l'écosystème, ou co-organisés avec nos partenaires."
        actions={
          <Link href="/evenements/galerie" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Images className="h-4 w-4" /> Galerie photos &amp; vidéos
          </Link>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.value === activeOrigin;
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/evenements?origin=${tab.value}` : '/evenements'}
              className={cn(
                'rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
                isActive ? 'bg-ink-900 text-white' : 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/9',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <EmptyState title="Aucun événement dans cette catégorie pour le moment" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </Container>
  );
}
