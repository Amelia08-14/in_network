import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Badge, EventOriginBadge } from '@/components/ui/badge';
import { ImageGallery } from '@/components/features/gallery/ImageGallery';
import { serverGet } from '@/lib/server-api';
import type { EventItem } from '@/types';
import { EventRegisterButton } from './register-button';

export const revalidate = 900;

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await serverGet<EventItem | null>(`/api/events/${slug}`, 900, null, 'events');
  if (!event) notFound();

  const isPast = new Date(event.endAt) < new Date();
  const isFull = event._count ? event._count.registrations >= event.capacity : false;

  return (
    <Container className="section-padding max-w-3xl">
      {event.videoUrl ? (
        <div className="relative mb-8 aspect-video overflow-hidden rounded-card bg-ink-900">
          <video src={event.videoUrl} controls playsInline className="h-full w-full object-cover">
            Ton navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>
      ) : (
        event.coverImage && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-card bg-ink-900">
            <Image src={event.coverImage} alt="" fill sizes="768px" className="object-cover" priority />
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <EventOriginBadge origin={event.origin} />
        <Badge variant="neutral">{event.type}</Badge>
      </div>
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
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {event.location}
          </span>
        )}
        {!isPast && event._count && (
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {event._count.registrations}/{event.capacity} inscrits
          </span>
        )}
      </div>

      {event.origin === 'CO_ORGANIZED' && event.coOrganizerName && (
        <div className="mt-6 flex items-center gap-3 rounded-card border border-ink-900/8 bg-ink-900/3 p-4">
          {event.coOrganizerLogoUrl && (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white">
              <Image src={event.coOrganizerLogoUrl} alt="" fill sizes="40px" className="object-contain" />
            </div>
          )}
          <p className="text-sm text-ink-700">
            Événement co-organisé avec <span className="font-semibold">{event.coOrganizerName}</span>
          </p>
        </div>
      )}
      {event.origin === 'EXTERNAL' && (
        <div className="mt-6 rounded-card border border-ink-900/8 bg-ink-900/3 p-4">
          <p className="text-sm text-ink-700">Événement externe relayé par IN NETWORK.</p>
        </div>
      )}

      <p className="mt-6 whitespace-pre-line text-ink-600">{event.description}</p>

      {(() => {
        const photos = event.gallery?.filter((item) => item.type === 'IMAGE') ?? [];
        const extraVideos = event.gallery?.filter((item) => item.type === 'VIDEO' && item.url !== event.videoUrl) ?? [];
        return (
          <>
            {photos.length > 1 && (
              <div className="mt-8">
                <h2 className="mb-3 font-heading text-lg font-bold text-ink-900">Galerie photo</h2>
                <ImageGallery images={photos} />
              </div>
            )}
            {extraVideos.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 font-heading text-lg font-bold text-ink-900">Autres vidéos</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {extraVideos.map((item) => (
                    <video key={item.id} src={item.url} controls playsInline className="aspect-video w-full rounded-card bg-black object-cover" />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {!isPast && (
        <div className="mt-8">
          <EventRegisterButton eventId={event.id} isFull={isFull} />
        </div>
      )}
    </Container>
  );
}
