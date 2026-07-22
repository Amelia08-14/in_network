import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// CDC §3.2 — orange = CTA principal (réserver, adhérer), violet = CTA secondaire.
// Ne jamais utiliser l'orange en texte fin sur blanc (contraste insuffisant) :
// réservé aux fonds de bouton avec texte blanc.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-900 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-orange text-white shadow-soft hover:-translate-y-0.5 hover:bg-brand-orange/90 hover:shadow-soft-lg active:translate-y-0',
        secondary: 'bg-ink-900 text-white shadow-soft hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-soft-lg active:translate-y-0',
        outline: 'border border-ink-900/15 bg-white text-ink-900 hover:border-ink-900/25 hover:bg-ink-900/[0.04]',
        'outline-light': 'border border-white/25 bg-white/5 text-white backdrop-blur hover:border-white/40 hover:bg-white/10',
        ghost: 'bg-transparent text-ink-700 hover:bg-ink-900/[0.05]',
        link: 'bg-transparent text-brand-blue underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3.5',
        md: 'h-11 px-5',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
