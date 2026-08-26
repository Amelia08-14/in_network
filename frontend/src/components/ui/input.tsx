import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-card border border-ink-900/15 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500/60 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ink-900 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
