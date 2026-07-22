import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, EVENT_TYPE_ACCENT } from '@/components/ui/badge';
import { NetworkMotif } from '@/components/ui/network-motif';
import type { EventItem } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  CONFERENCE: 'Conférence',
  ATELIER: 'Atelier',
  NETWORKING: 'Networking',
  MASTERCLASS: 'Masterclass',
};

export function EventCard({ event }: { event: EventItem }) {
  const isPast = new Date(event.endAt) < new Date();
  const isFull = event._count ? event._count.registrations >= event.capacity : false;

  return (
    <Link href={`/evenements/${event.slug}`}>
      <Card accent={EVENT_TYPE_ACCENT[event.type] ?? 'none'} className="h-full overflow-hidden">
        <div className="relative flex h-32 items-center justify-center overflow-hidden bg-ink-900 text-white">
          <NetworkMotif tone="white" className="absolute inset-0 h-full w-full opacity-70" />
          <CalendarDays className="relative h-8 w-8 opacity-90" />
        </div>
        <CardContent className="flex flex-col gap-2 pl-6">
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{TYPE_LABEL[event.type] ?? event.type}</Badge>
            {isPast && <Badge variant="neutral">Passé</Badge>}
            {!isPast && isFull && <Badge variant="startup">Complet</Badge>}
          </div>
          <h3 className="font-heading font-bold text-ink-900">{event.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin className="h-3.5 w-3.5" />
            {new Date(event.startAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {event._count && (
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Users className="h-3.5 w-3.5" />
              {event._count.registrations}/{event.capacity} inscrits
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
