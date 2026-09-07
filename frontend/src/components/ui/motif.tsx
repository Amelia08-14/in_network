import { cn } from '@/lib/utils';

// Filigrane damassé de marque (cf. /public/background/background.svg).
// Rendu via masque CSS pour être teintable et posé très discrètement.
// Positionnement & taille pilotés par `className` (débordement hors cadre
// recommandé pour masquer le liseré du motif).
const TINT = {
  light: 'bg-white',
  aubergine: 'bg-ink-900',
  violet: 'bg-ink-900',
} as const;

export function Motif({
  className,
  tint = 'light',
  opacity = 0.06,
}: {
  className?: string;
  tint?: keyof typeof TINT;
  opacity?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn('damask pointer-events-none absolute select-none', TINT[tint], className)}
      style={{ opacity }}
    />
  );
}
