import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatWidget({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-card bg-ink-900/10 text-ink-700')}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
          <p className="font-heading text-2xl font-bold text-ink-900">{value}</p>
          {hint && <p className="text-xs text-ink-500">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
