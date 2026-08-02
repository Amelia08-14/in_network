import Image from 'next/image';
import { cn } from '@/lib/utils';

// Avatar générique (initiales sur dégradé navy → orange) pour les fiches
// experts/partenaires en attente de photo réelle — jamais de photo banque.
export function AvatarPlaceholder({
  name,
  photoUrl,
  size = 44,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <div
        className={cn('relative shrink-0 overflow-hidden rounded-lg bg-ink-900/5', className)}
        style={{ width: size, height: size }}
      >
        <Image src={photoUrl} alt={name} fill sizes={`${size}px`} className="object-cover" />
      </div>
    );
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ink-900 to-brand-orange text-white',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-heading font-bold" style={{ fontSize: size * 0.36 }}>
        {initials || '?'}
      </span>
    </div>
  );
}
