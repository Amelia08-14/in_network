import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Partner } from '@/types';

function PartnerLogo({ partner }: { partner: Partner }) {
  return (
    <div className="relative h-14 w-full">
      <Image src={partner.logoUrl} alt={partner.name} fill sizes="200px" className="object-contain object-left" />
    </div>
  );
}

export function PartnerCard({ partner }: { partner: Partner }) {
  const content = (
    <Card accent="blue" className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <PartnerLogo partner={partner} />
        <div>
          <p className="font-heading font-bold text-ink-900">{partner.name}</p>
          <p className="text-sm text-ink-500">{partner.sector}</p>
        </div>
        {partner.description && <p className="line-clamp-3 text-sm text-ink-600">{partner.description}</p>}
      </CardContent>
    </Card>
  );

  if (!partner.websiteUrl) return content;

  return (
    <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="block h-full">
      {content}
    </a>
  );
}
