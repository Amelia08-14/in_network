import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Logo officiel IN NETWORK (Brand Guideline p.5-6, fichier « LOGO IN NETWORK »
// fourni par le client), détouré en PNG transparent :
//   - public/logo-in-network-bleu-nuit.png : version couleur (fonds clairs), « IN
//     NETWORK » en bleu nuit #001042 (charte Bleu Nuit, 26/10/2026)
//   - public/logo-in-network-white.png  : « IN NETWORK » en blanc, symbole
//     conservé en couleurs — version prévue par la charte pour les fonds
//     violet / orange / bleu (p.8). Plus de filtre CSS monochrome.
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
    <Link href="/" aria-label="IN NETWORK — accueil" className="inline-flex items-center">
      <Image
        src={variant === 'light' ? '/logo-in-network-white.png' : '/logo-in-network-bleu-nuit.png'}
        alt="IN NETWORK"
        width={1400}
        height={759}
        priority={priority}
        className={cn('h-10 w-auto', className)}
      />
    </Link>
  );
}
