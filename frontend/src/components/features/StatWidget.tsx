import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HUE, HUE_ACCENT, type Hue } from '@/lib/palette';

export function StatWidget({
  icon: Icon,
  label,
  value,
  hint,
  className,
  hue,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
  /** Teinte fonctionnelle (bandeau + médaillon) ; sans teinte : rendu neutre. */
  hue?: Hue;
}) {
  const h = hue ? HUE[hue] : null;
  return (
    <Card accent={hue ? HUE_ACCENT[hue] : 'none'} className={className}>
      <CardContent className="flex items-center gap-4">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-card', h ? cn(h.soft, h.text) : 'bg-ink-900/10 text-ink-700')}>
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
