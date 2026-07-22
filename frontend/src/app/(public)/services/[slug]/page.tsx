import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serverGet } from '@/lib/server-api';
import type { ServiceCatalogItem } from '@/types';

export const revalidate = 3600;

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = await serverGet<ServiceCatalogItem | null>(`/api/services/${params.slug}`, 3600, null);
  if (!service) notFound();

  return (
    <Container className="section-padding max-w-3xl">
      <Badge variant="neutral">{service.category}</Badge>
      <h1 className="mt-3 font-heading text-3xl font-bold text-ink-900">{service.title}</h1>
      <p className="mt-4 whitespace-pre-line text-ink-600">{service.description}</p>
      {service.priceFrom && (
        <p className="mt-6 font-heading text-2xl font-bold text-brand-orange">
          à partir de {service.priceFrom} DZD
        </p>
      )}
      <div className="mt-8">
        <Button variant="primary" size="lg">
          Demander ce service
        </Button>
        <p className="mt-2 text-xs text-ink-500">Connecte-toi pour envoyer ta demande.</p>
      </div>
    </Container>
  );
}
