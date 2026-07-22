import { notFound } from 'next/navigation';
import { CalendarDays, Users } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { serverGet } from '@/lib/server-api';
import type { EventItem } from '@/types';
import { EventRegisterButton } from './register-button';

export const revalidate = 900;

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const event = await serverGet<EventItem | null>(`/api/events/${params.slug}`, 900, null);
  if (!event) notFound();

  const isFull = event._count ? event._count.registrations >= event.capacity : false;

  return (
    <Container className="section-padding max-w-3xl">
      <Badge variant="neutral">{event.type}</Badge>
      <h1 className="mt-3 font-heading text-3xl font-bold text-ink-900">{event.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-ink-500">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          {new Date(event.startAt).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {event._count && (
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {event._count.registrations}/{event.capacity} inscrits
          </span>
        )}
      </div>

      <p className="mt-6 whitespace-pre-line text-ink-600">{event.description}</p>

      <div className="mt-8">
        <EventRegisterButton eventId={event.id} isFull={isFull} />
      </div>
    </Container>
  );
}
