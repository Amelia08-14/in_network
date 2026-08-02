import { Handshake } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { PartnerCard } from '@/components/features/PartnerCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import type { Partner } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Partenaires' };

export default async function PartenairesPage() {
  const partners = await serverGet<Partner[]>('/api/partners', 3600, []);

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Écosystème"
        title={<>Nos <span className="text-brand-orange">partenaires</span></>}
        description="Les institutions et entreprises qui accompagnent le réseau IN NETWORK."
      />

      {partners.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Nos partenaires arrivent bientôt"
          description="Cette page sera mise à jour dès que les premières fiches partenaires seront publiées."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {partners.map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
      )}
    </Container>
  );
}
