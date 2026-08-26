import { cn } from '@/lib/utils';

// En-tête de page interne — utilisé sur toutes les pages secondaires
// (annuaire, experts, services, tarifs, événements...). Un seul composant à
// faire évoluer pour élever tout le site d'un coup : liseré vertical
// orange en gouttière éditoriale, eyebrow en pastille, typographie massive.
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
  return (
    <div
      className={cn(
        'relative mb-12 flex flex-col gap-5 pb-10 pl-6 md:mb-16 md:pb-12',
        align === 'center' && 'items-center pl-0 text-center',
        className,
      )}
    >
      {align !== 'center' && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-brand-orange via-ink-900/15 to-transparent" />
      )}
      {eyebrow && (
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink-900/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
          {eyebrow}
        </span>
      )}
      <h1 className="font-heading text-4xl font-bold leading-[1.02] tracking-tight text-ink-900 md:text-5xl lg:text-6xl">
        {title}
      </h1>
      {description && (
        <p className={cn('max-w-2xl text-lg leading-relaxed text-ink-500', align === 'center' && 'mx-auto')}>
          {description}
        </p>
      )}
      {actions && <div className="mt-2">{actions}</div>}
    </div>
  );
}
