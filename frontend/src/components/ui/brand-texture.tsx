import { cn } from '@/lib/utils';

// Texture de marque du groupe (La Maison IN Groupe) — motif background.svg,
// même traitement que la couche globale (tuilé, soft-light) mais posé
// localement sur les sections à fond opaque (Hero, CTA, footer) où la
// couche globale fixe ne peut pas transparaître.
export function BrandTexture({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: 'url(/background/background.svg)',
        backgroundSize: '460px 460px',
        backgroundRepeat: 'repeat',
        opacity: 0.4,
        mixBlendMode: 'soft-light',
      }}
    />
  );
}
