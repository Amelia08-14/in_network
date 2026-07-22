import { cn } from '@/lib/utils';

// Langage "carte de visite" — chaque card du site (membre, service, événement,
// tarif) porte une tranche de couleur à gauche, comme l'épine d'une fiche
// cartonnée. La couleur encode une vraie catégorie (type de membre, catégorie
// de service...), voir les maps ACCENT_* dans badge.tsx — ce n'est pas une
// décoration gratuite.
const ACCENT_MAP = {
  orange: 'bg-brand-orange',
  blue: 'bg-brand-blue',
  ink: 'bg-ink-700',
  green: 'bg-accent-green',
  yellow: 'bg-accent-yellow',
  none: 'bg-transparent',
} as const;

export type CardAccent = keyof typeof ACCENT_MAP;

export function Card({
  className,
  accent = 'none',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { accent?: CardAccent }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card bg-white shadow-soft transition-all duration-200 hover:-translate-y-1 hover:rotate-[0.4deg] hover:shadow-soft-lg',
        className,
      )}
      {...props}
    >
      {accent !== 'none' && (
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', ACCENT_MAP[accent])} />
      )}
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-heading text-lg font-bold text-ink-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-ink-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />;
}
