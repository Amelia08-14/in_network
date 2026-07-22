import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { CardAccent } from './card';

// CDC §3.4 — élément signature : badge de couleur dynamique selon memberType
// (freelance = bleu, startup = orange, PME = violet, expert = vert).
const badgeVariants = cva('inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      freelance: 'bg-brand-blue/10 text-brand-blue',
      startup: 'bg-brand-orange/10 text-brand-orange',
      pme: 'bg-brand-violet/10 text-brand-violet',
      diaspora: 'bg-accent-yellow/20 text-yellow-800',
      expert: 'bg-accent-green/20 text-green-800',
      neutral: 'bg-ink-900/[0.06] text-ink-700',
      success: 'bg-accent-green/20 text-green-800',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const MEMBER_TYPE_VARIANT: Record<string, BadgeProps['variant']> = {
  FREELANCE: 'freelance',
  STARTUP: 'startup',
  PME: 'pme',
  DIASPORA: 'diaspora',
  AUTRE: 'neutral',
};

export function MemberTypeBadge({ memberType }: { memberType: string }) {
  return <Badge variant={MEMBER_TYPE_VARIANT[memberType] ?? 'neutral'}>{memberType}</Badge>;
}

// Mêmes catégories que les badges ci-dessus, réutilisées comme couleur de
// tranche sur les cards (voir Card `accent` dans card.tsx) — une seule source
// de vérité pour "quelle couleur veut dire quoi" sur tout le site.
export const MEMBER_TYPE_ACCENT: Record<string, CardAccent> = {
  FREELANCE: 'blue',
  STARTUP: 'orange',
  PME: 'ink',
  DIASPORA: 'yellow',
  AUTRE: 'none',
};

export const SERVICE_CATEGORY_ACCENT: Record<string, CardAccent> = {
  DOMICILIATION: 'blue',
  CREATION_ENTREPRISE: 'orange',
  COMPTABILITE: 'green',
  JURIDIQUE: 'ink',
  MARKETING: 'yellow',
  AUTRE: 'none',
};

export const EVENT_TYPE_ACCENT: Record<string, CardAccent> = {
  CONFERENCE: 'blue',
  ATELIER: 'green',
  NETWORKING: 'orange',
  MASTERCLASS: 'ink',
};
