import { cn } from '@/lib/utils';

// Langage "carte de visite" — chaque card du site (membre, service, événement,
// tarif) porte une tranche de couleur à gauche, comme l'épine d'une fiche
// cartonnée. La couleur encode une vraie catégorie (type de membre, catégorie
// de service...), voir les maps ACCENT_* dans badge.tsx — ce n'est pas une
// décoration gratuite.
export const ACCENT_MAP = {
  orange: 'bg-brand-orange',
  blue: 'bg-brand-blue',
  ink: 'bg-ink-700',
  green: 'bg-accent-green',
  yellow: 'bg-accent-yellow',
  none: 'bg-transparent',
} as const;

export type CardAccent = keyof typeof ACCENT_MAP;

// Variante texte de ACCENT_MAP — même mapping catégorie → couleur, ajusté
// pour rester lisible en petit texte sur fond clair (les teintes "green"/
// "yellow" du système sont trop claires pour du texte, cf. ratio de contraste).
export const ACCENT_TEXT_MAP: Record<CardAccent, string> = {
  orange: 'text-brand-orange',
  blue: 'text-brand-blue',
  ink: 'text-ink-700',
  green: 'text-green-700',
  yellow: 'text-amber-700',
  none: 'text-ink-500',
};

// Card à plat, chaude et douce — grand rayon, bordure fine, ombre discrète
// qui se creuse légèrement au survol. La tranche de couleur (accent) reste
// le langage "carte de visite" du site pour les catégories réelles (type de
// membre, catégorie de service...), mais posée sur une seule coque simple
// plutôt qu'un double-bezel imbriqué — plus proche du registre de référence
// (cards agence chaleureuses) que d'un bijou premium à facettes.
export function Card({
  className,
  accent = 'none',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { accent?: CardAccent }) {
  return (
    <div
      className={cn(
        'group/card relative overflow-hidden rounded-2xl border border-ink-900/[0.07] bg-white shadow-soft transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-ink-900/[0.12] hover:shadow-soft-lg',
        className,
      )}
      {...props}
    >
      {accent !== 'none' && (
        <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', ACCENT_MAP[accent])} />
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
