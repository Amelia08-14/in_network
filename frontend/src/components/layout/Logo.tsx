import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// CDC §3.1 — logo officiel IN NETWORK (public/LOGO_IN_NETWORK.png).
// Sur fond sombre (footer, panneau auth), pas d'asset blanc dédié fourni :
// on rend le logo en blanc monochrome via `brightness-0 invert` — net et
// corporate. Fournir une version blanche vectorielle donnerait un rendu
// encore plus propre (l'icône dégradée deviendrait alors blanche unie).
export function Logo({
  variant = 'dark',
  priority = false,
}: {
  variant?: 'dark' | 'light';
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="IN NETWORK — accueil"
      className="inline-flex items-center"
    >
      <Image
        src="/LOGO_IN_NETWORK.png"
        alt="IN NETWORK"
        width={1191}
        height={675}
        priority={priority}
        className={cn('h-9 w-auto', variant === 'light' && 'brightness-0 invert')}
      />
    </Link>
  );
}
