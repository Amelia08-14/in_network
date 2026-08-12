import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { EventMediaWall } from '@/components/features/gallery/EventMediaWall';
import { serverGet } from '@/lib/server-api';
import type { EventMediaItem } from '@/types';

export const revalidate = 900;
export const metadata = { title: 'Galerie des événements' };

export default async function EvenementsGaleriePage() {
  const items = await serverGet<EventMediaItem[]>('/api/events/gallery', 900, [], 'events');

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Agenda"
        title={<>Galerie des <span className="text-brand-orange">événements</span></>}
        description="Photos et vidéos des événements IN NETWORK — organisés en interne, relayés ou co-organisés avec nos partenaires."
        actions={
          <Link href="/evenements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour aux événements
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="La galerie se construit" description="Les photos et vidéos des prochains événements apparaîtront ici." />
      ) : (
        <EventMediaWall items={items} />
      )}
    </Container>
  );
}
