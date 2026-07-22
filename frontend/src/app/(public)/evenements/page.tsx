import { Container } from '@/components/ui/container';
import { EventCard } from '@/components/features/EventCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import type { EventItem } from '@/types';

export const revalidate = 900;
export const metadata = { title: 'Événements' };

export default async function EvenementsPage() {
  const events = await serverGet<EventItem[]>('/api/events', 900, []);

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Agenda"
        title="Événements"
        description="Conférences, ateliers, sessions de networking et masterclass organisés à IN NETWORK Hydra."
      />

      {events.length === 0 ? (
        <EmptyState title="Aucun événement programmé pour le moment" />
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
