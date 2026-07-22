import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge, SERVICE_CATEGORY_ACCENT } from '@/components/ui/badge';
import type { ServiceCatalogItem } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  DOMICILIATION: 'Domiciliation',
  CREATION_ENTREPRISE: "Création d'entreprise",
  COMPTABILITE: 'Comptabilité',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  AUTRE: 'Autre',
};

export function ServiceCard({ service }: { service: ServiceCatalogItem }) {
  return (
    <Card
      accent={SERVICE_CATEGORY_ACCENT[service.category] ?? 'none'}
      className="flex h-full flex-col justify-between"
    >
      <CardContent className="flex flex-col gap-2 pl-6">
        <Badge variant="neutral">{CATEGORY_LABEL[service.category] ?? service.category}</Badge>
        <h3 className="font-heading font-bold text-ink-900">{service.title}</h3>
        <p className="line-clamp-3 text-sm text-ink-600">{service.description}</p>
        {service.priceFrom && (
          <p className="text-sm font-semibold text-brand-orange">à partir de {service.priceFrom} DZD</p>
        )}
      </CardContent>
      <CardFooter className="pl-6">
        <Link
          href={`/services/${service.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
        >
          Demander ce service <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
