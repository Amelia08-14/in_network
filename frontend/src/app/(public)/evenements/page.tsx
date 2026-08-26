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

// Brief client §4.7 — séparer clairement à venir / passés plutôt que tout
// mélanger dans une seule liste triée par date.
const WHEN_TABS = [
  { label: 'À venir', value: 'upcoming' as const },
  { label: 'Passés', value: 'past' as const },
];

export default async function EvenementsPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; when?: string }>;
}) {
  const { origin, when } = await searchParams;
  const activeOrigin = TABS.find((t) => t.value === origin)?.value;
  const activeWhen = when === 'past' ? 'past' : 'upcoming';
  const query = activeOrigin ? `?origin=${activeOrigin}` : '';
  const allEvents = await serverGet<EventItem[]>(`/api/events${query}`, 900, [], 'events');

  /* eslint-disable react-hooks/purity -- Server Component : ré-exécuté à chaque
     requête serveur, pas mémoïsé par le React Compiler (règle pensée pour le
     rendu client) ; lire l'heure courante ici est le comportement voulu. */
  const now = Date.now();
  const events =
    activeWhen === 'past'
      ? allEvents.filter((e) => new Date(e.endAt).getTime() < now).reverse()
      : allEvents.filter((e) => new Date(e.endAt).getTime() >= now);
  /* eslint-enable react-hooks/purity */

  function buildHref(targetOrigin: EventOrigin | undefined, targetWhen: 'upcoming' | 'past') {
    const params = new URLSearchParams();
    if (targetOrigin) params.set('origin', targetOrigin);
    if (targetWhen !== 'upcoming') params.set('when', targetWhen);
    const qs = params.toString();
    return qs ? `/evenements?${qs}` : '/evenements';
  }

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

      <div className="mb-4 flex gap-2">
        {WHEN_TABS.map((tab) => {
          const isActive = tab.value === activeWhen;
          return (
            <Link
              key={tab.value}
              href={buildHref(activeOrigin, tab.value)}
              className={cn(
                'rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
                isActive ? 'bg-brand-orange text-white' : 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/9',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.value === activeOrigin;
          return (
            <Link
              key={tab.label}
              href={buildHref(tab.value, activeWhen)}
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
        <EmptyState
          title={
            activeWhen === 'past'
              ? "Aucun événement passé dans cette catégorie pour l'instant"
              : 'Aucun événement à venir dans cette catégorie pour le moment'
          }
        />
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
