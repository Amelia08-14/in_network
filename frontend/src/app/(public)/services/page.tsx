import { Container } from '@/components/ui/container';
import { ServiceCard } from '@/components/features/ServiceCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import type { ServiceCatalogItem } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Catalogue de services' };

export default async function ServicesPage() {
  const services = await serverGet<ServiceCatalogItem[]>('/api/services', 3600, []);

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Services"
        title={<>Catalogue de services <span className="text-brand-orange">entrepreneuriaux</span></>}
        description="Domiciliation, création d'entreprise, comptabilité, juridique, marketing — des prestataires de confiance pour t'accompagner."
      />

      {services.length === 0 ? (
        <EmptyState title="Catalogue en préparation" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </Container>
  );
}
