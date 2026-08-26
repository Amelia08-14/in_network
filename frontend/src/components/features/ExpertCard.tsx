import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExpertSummary } from '@/types';

export function ExpertCard({
  expert,
  featured = false,
}: {
  expert: ExpertSummary;
  featured?: boolean;
}) {
  const initials = expert.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Link
      href={`/experts/${expert.id}`}
      className={cn(
        'group block h-full overflow-hidden rounded-[1.35rem] border bg-white p-2 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft-lg',
        featured ? 'border-ink-900 bg-ink-900' : 'border-ink-900/8',
      )}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-[1rem] bg-linear-to-br from-ink-800 to-ink-900">
        {expert.photoUrl ? (
          <Image
            src={expert.photoUrl}
            alt={expert.displayName}
            fill
            sizes="(min-width: 1024px) 33vw, 50vw"
            className="object-cover grayscale transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_70%_20%,rgba(212,72,53,0.55),transparent_42%)]">
            <span className="font-heading text-6xl font-bold text-white/90">{initials || '?'}</span>
          </div>
        )}

        {expert.isVerified && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-900 shadow-xs backdrop-blur-sm">
            <BadgeCheck className="h-3.5 w-3.5 text-brand-orange" /> Vérifié
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 px-3 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className={cn('truncate font-heading text-lg font-bold', featured ? 'text-white' : 'text-ink-900')}>
            {expert.displayName}
          </h3>
          <p className={cn('mt-1 line-clamp-2 text-sm leading-snug', featured ? 'text-white/65' : 'text-ink-500')}>
            {expert.expertiseArea}
          </p>
          {expert.companyName && (
            <p className={cn('mt-2 text-[11px] font-semibold uppercase tracking-wide', featured ? 'text-white/45' : 'text-ink-500')}>
              {expert.companyName}
            </p>
          )}
        </div>

        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:rotate-12',
            featured ? 'bg-brand-orange text-white' : 'bg-ink-900/6 text-ink-900',
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
