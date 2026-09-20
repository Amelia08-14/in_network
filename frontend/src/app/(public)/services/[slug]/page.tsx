import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { CATEGORY_LABEL } from '@/components/features/ServiceCard';
import { serverGet } from '@/lib/server-api';
import type { ServiceCatalogItem } from '@/types';

export const revalidate = 3600;

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await serverGet<ServiceCatalogItem | null>(`/api/services/${slug}`, 3600, null, 'services');
  if (!service) notFound();
  const tiers = service.pricingTiers ?? [];

  return (
    <Container className="section-padding max-w-3xl">
      <Badge variant="neutral">{CATEGORY_LABEL[service.category] ?? service.category}</Badge>
      <h1 className="mt-3 font-heading text-3xl font-bold text-ink-900">{service.title}</h1>
      <p className="mt-4 whitespace-pre-line text-ink-600">{service.description}</p>

      {tiers.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-2">
          {tiers.map((tier) => (
            <li key={tier.label} className="flex items-center gap-4 rounded-xl bg-ink-900/3 py-3 pl-4 pr-3">
              <span className="min-w-0 flex-1 text-ink-700">{tier.label}</span>
              <span className="shrink-0 whitespace-nowrap font-heading text-xl font-bold tabular-nums text-brand-orange">
                {tier.price.toLocaleString('fr-FR')} DZD
              </span>
              <AddToCartButton
                item={{
                  targetType: 'SERVICE',
                  targetId: service.id,
                  title: service.title,
                  tierLabel: tier.label,
                  price: tier.price,
                }}
                variant="primary"
                size="sm"
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="font-heading text-xl font-bold text-ink-900">Sur devis</p>
          <AddToCartButton
            item={{ targetType: 'SERVICE', targetId: service.id, title: service.title, price: null }}
            variant="primary"
            size="lg"
          />
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/services" className="font-medium text-brand-blue hover:underline">
          ← Tous les services
        </Link>
        <Link href="/devis" className={buttonVariants({ variant: 'link', size: 'sm' })}>
          Voir ma demande de devis
        </Link>
      </div>
    </Container>
  );
}
