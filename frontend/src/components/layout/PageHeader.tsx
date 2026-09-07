import { cn } from '@/lib/utils';
import { NetworkMotif } from '@/components/ui/network-motif';

// En-tête de page interne — utilisé sur toutes les pages secondaires
// (annuaire, experts, services, tarifs, événements...). Un seul composant à
// faire évoluer pour élever tout le site d'un coup : gouttière éditoriale
// orange, eyebrow à filet, titrage display massif, texture réseau en
// filigrane à droite.
export function PageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  actions?: React.ReactNode;
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <div
      className={cn(
        'relative isolate mb-12 flex flex-col gap-5 pb-10 md:mb-16 md:pb-12',
        centered ? 'items-center text-center' : 'pl-6',
        className,
      )}
    >
      {!centered && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-brand-orange via-ink-900/15 to-transparent"
        />
      )}
      <NetworkMotif
        tone="ink"
        variant="sparse"
        className="pointer-events-none absolute -right-10 -top-10 -z-10 hidden h-[240px] w-[320px] opacity-[0.35] md:block"
      />

      {eyebrow && (
        <p
          className={cn(
            'flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500',
            centered && 'justify-center',
          )}
        >
          <span className="h-px w-8 bg-brand-orange" />
          {eyebrow}
        </p>
      )}

      <h1 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink-900">
        {title}
      </h1>

      {description && (
        <p
          className={cn(
            'max-w-2xl text-lg leading-relaxed text-ink-600',
            centered && 'mx-auto',
          )}
        >
          {description}
        </p>
      )}
      {actions && <div className="mt-2">{actions}</div>}
    </div>
  );
}
