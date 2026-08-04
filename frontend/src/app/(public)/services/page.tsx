import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { ServicesFilterGrid } from '@/components/features/ServicesFilterGrid';
import { InquiryForm } from '@/components/features/InquiryForm';
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

      {services.length > 0 && (
        <Card accent="orange" className="mb-10">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-lg font-bold text-ink-900">Tu ne sais pas quel service choisir ?</p>
              <p className="mt-1 text-sm text-ink-500">
                Dis-nous ce dont tu as besoin, on te met en relation avec le bon prestataire.
              </p>
            </div>
            <InquiryForm
              targetType="SERVICE"
              targetId={services[0].id}
              options={services.map((service) => ({
                key: service.id,
                targetId: service.id,
                label: service.title,
                subOptions: service.pricingTiers?.map((tier, index) => ({
                  key: `${service.id}-${index}`,
                  label: `${tier.label} — ${tier.price.toLocaleString('fr-FR')} DZD`,
                  noteHint: `Sous-service sélectionné : ${tier.label}\nTarif indicatif : ${tier.price.toLocaleString('fr-FR')} DZD`,
                })),
              }))}
              ctaLabel="Demander un service"
              ctaVariant="primary"
              ctaSize="lg"
              className="shrink-0"
            />
          </CardContent>
        </Card>
      )}

      {services.length === 0 ? (
        <EmptyState title="Catalogue en préparation" />
      ) : (
        <ServicesFilterGrid services={services} />
      )}
    </Container>
  );
}
