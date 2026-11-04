import { Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lien vers le profil LinkedIn d'un expert (demande cliente 04/11/2026). Sans
// lien renseigné, le bouton reste visible mais grisé et non cliquable.
export function LinkedInLink({
  url,
  name,
  variant = 'button',
  className,
}: {
  url: string | null | undefined;
  name: string;
  variant?: 'button' | 'icon';
  className?: string;
}) {
  const isIcon = variant === 'icon';
  const base = isIcon
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full'
    : 'inline-flex items-center gap-2 rounded-card px-4 py-2.5 text-sm font-semibold';

  if (!url) {
    return (
      <span
        aria-disabled="true"
        title="Profil LinkedIn non renseigné"
        className={cn(base, 'cursor-not-allowed bg-ink-900/[0.05] text-ink-300', className)}
      >
        <Linkedin className="h-4 w-4" aria-hidden />
        {isIcon ? <span className="sr-only">Profil LinkedIn de {name} non renseigné</span> : 'LinkedIn'}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Profil LinkedIn de ${name} (nouvel onglet)`}
      className={cn(base, 'bg-brand-blue text-white transition-colors hover:bg-ink-900', className)}
    >
      <Linkedin className="h-4 w-4" aria-hidden />
      {!isIcon && 'LinkedIn'}
    </a>
  );
}
