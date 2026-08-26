import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { InquiryForm } from '@/components/features/InquiryForm';
import { CATEGORY_LABEL } from '@/components/features/ServiceCard';
import { serverGet } from '@/lib/server-api';
import type { ServiceCatalogItem } from '@/types';

export const revalidate = 3600;

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [service, allServices] = await Promise.all([
    serverGet<ServiceCatalogItem | null>(`/api/services/${slug}`, 3600, null, 'services'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
  ]);
  if (!service) notFound();
  const selectableServices = [service, ...allServices.filter((item) => item.id !== service.id)];

  return (
    <Container className="section-padding max-w-3xl">
      <Badge variant="neutral">{CATEGORY_LABEL[service.category] ?? service.category}</Badge>
      <h1 className="mt-3 font-heading text-3xl font-bold text-ink-900">{service.title}</h1>
      <p className="mt-4 whitespace-pre-line text-ink-600">{service.description}</p>
      {service.priceFrom && (
        <p className="mt-6 font-heading text-2xl font-bold text-brand-orange">
          à partir de {service.priceFrom} DZD
        </p>
      )}
      <div className="mt-8">
        <InquiryForm
          targetType="SERVICE"
          targetId={service.id}
          options={selectableServices.map((item) => ({
            key: item.id,
            targetId: item.id,
            label: item.title,
            subOptions: item.pricingTiers?.map((tier, index) => ({
              key: `${item.id}-${index}`,
              label: `${tier.label} — ${tier.price.toLocaleString('fr-FR')} DZD`,
              noteHint: `Sous-service sélectionné : ${tier.label}\nTarif indicatif : ${tier.price.toLocaleString('fr-FR')} DZD`,
            })),
          }))}
          ctaLabel="Demander ce service"
        />
      </div>
    </Container>
  );
}
