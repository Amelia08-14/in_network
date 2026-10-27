import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, EVENT_TYPE_ACCENT, EventOriginBadge } from '@/components/ui/badge';
import { NetworkMotif } from '@/components/ui/network-motif';
import { MotionSafeVideo } from '@/components/ui/motion-safe-video';
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
      <Card accent={EVENT_TYPE_ACCENT[event.type] ?? 'none'} className="flex h-full flex-col overflow-hidden">
        <div className="relative flex h-32 items-center justify-center overflow-hidden bg-ink-900 text-white">
          {event.coverImage ? (
            <Image src={event.coverImage} alt="" fill sizes="400px" className="object-cover" />
          ) : event.videoUrl ? (
            <MotionSafeVideo
              src={event.videoUrl}
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <NetworkMotif tone="white" className="absolute inset-0 h-full w-full opacity-70" />
              <CalendarDays className="relative h-8 w-8 opacity-90" />
            </>
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <EventOriginBadge origin={event.origin} />
            <Badge variant="neutral">{TYPE_LABEL[event.type] ?? event.type}</Badge>
            {isPast && <Badge variant="neutral">Passé</Badge>}
            {!isPast && isFull && <Badge variant="startup">Complet</Badge>}
          </div>
          <h3 className="font-heading font-bold text-ink-900">{event.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {/* Date complète, année comprise (audit : éviter de confondre passé et à venir). */}
            {new Date(event.startAt).toLocaleDateString('fr-FR', {
              weekday: isPast ? undefined : 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              ...(isPast ? {} : { hour: '2-digit', minute: '2-digit' }),
              // Heure d'Alger, quel que soit le fuseau du serveur qui rend la page.
              timeZone: 'Africa/Algiers',
            })}
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          )}
          {!isPast && event._count && (
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Users className="h-3.5 w-3.5" />
              {event._count.registrations}/{event.capacity} inscrits
            </p>
          )}
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-orange">
            {isPast ? 'Revivre l’événement' : isFull ? 'Voir l’événement' : 'S’inscrire'} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
