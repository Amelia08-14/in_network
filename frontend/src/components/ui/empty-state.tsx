import type { LucideIcon } from 'lucide-react';
import { Sparkle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

// État vide — traité comme un vrai module de la page, pas un texte gris
// oublié : cadre en pointillés, icône en médaillon double coque, même
// langage visuel que les cards. Utilisé sur la plupart des pages tant que
// le contenu réel (membres, partenaires, photos...) se construit.
export function EmptyState({ icon: Icon = Sparkle, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-ink-900/12 bg-ink-900/1.5 px-8 py-20 text-center',
        className,
      )}
    >
      <div className="rounded-[1.25rem] bg-white p-1.5 shadow-soft ring-1 ring-ink-900/6">
        <div className="flex h-12 w-12 items-center justify-center rounded-[0.9rem] bg-brand-orange/10 text-brand-orange">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-lg font-bold text-ink-900">{title}</p>
        {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
