import { cn } from '@/lib/utils';

// Papier peint de la marque sur les surfaces bleu nuit (sections, bandeaux,
// footer) : variante blanche du motif, opacité intégrée au SVG, pour que le
// motif reste visible en léger partout, comme la variante claire du fond global.
export function BrandTexture({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: 'url(/background/motif-sombre.svg)',
        backgroundSize: '560px 555px',
        backgroundRepeat: 'repeat',
      }}
    />
  );
}
