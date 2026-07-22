import { cn } from '@/lib/utils';

// En-tête de page interne — remplace les H1 nus qui variaient d'une page
// publique à l'autre (annuaire, experts, services...). Donne une identité
// cohérente à tout le site sans jouer la carte du hero à chaque fois.
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
        'mb-10 flex flex-col gap-3 border-b border-ink-900/[0.07] pb-8 md:mb-12 md:pb-10',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="font-heading text-3xl font-bold leading-tight text-ink-900 md:text-4xl">{title}</h1>
      {description && (
        <p className={cn('max-w-2xl text-ink-500', align === 'center' && 'mx-auto')}>{description}</p>
      )}
      {actions && <div className="mt-2">{actions}</div>}
    </div>
  );
}
