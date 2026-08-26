import { Camera } from 'lucide-react';
import { NetworkMotif } from '@/components/ui/network-motif';
import { cn } from '@/lib/utils';

// État "à venir" pour la galerie du lieu — tant qu'aucune vraie photo n'est
// reçue, on ne comble jamais avec une photo banque : ce panneau assume
// l'attente plutôt que de la cacher.
export function GalleryComingSoon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex aspect-16/10 flex-col items-center justify-center overflow-hidden rounded-card border border-ink-900/10 bg-ink-900',
        className,
      )}
    >
      <NetworkMotif tone="white" variant="sparse" className="absolute inset-0 h-full w-full opacity-50" />
      <div className="relative flex flex-col items-center gap-3 px-8 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
          <Camera className="h-4.5 w-4.5 text-white/80" strokeWidth={1.75} />
        </div>
        <p className="font-heading text-lg font-bold text-white">Le lieu, bientôt en images</p>
        <p className="max-w-xs text-sm text-white/60">
          Les vraies photos de l&apos;espace Hydra arrivent prochainement.
        </p>
      </div>
    </div>
  );
}
