import { cn } from '@/lib/utils';

export function Separator({ className }: { className?: string }) {
  return <hr className={cn('border-t border-ink-900/8', className)} />;
}
