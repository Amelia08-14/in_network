import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// CDC §3.1 — logo officiel IN NETWORK (public/logo-in-network.png — LOGO_IN_NETWORK.png sans ses marges transparentes).
// Sur fond sombre (footer, panneau auth), pas d'asset blanc dédié fourni :
// on rend le logo en blanc monochrome via `brightness-0 invert` — net et
// corporate. Fournir une version blanche vectorielle donnerait un rendu
// encore plus propre (l'icône dégradée deviendrait alors blanche unie).
export function Logo({
  variant = 'dark',
  priority = false,
  className,
}: {
  variant?: 'dark' | 'light';
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="IN NETWORK — accueil"
      className="inline-flex items-center"
    >
      <Image
        src="/logo-in-network.png"
        alt="IN NETWORK"
        width={1104}
        height={595}
        priority={priority}
        className={cn('h-10 w-auto', variant === 'light' && 'brightness-0 invert', className)}
      />
    </Link>
  );
}
