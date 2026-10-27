'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { VenuePhoto } from '@/lib/venue-photos';

export interface OfficeShot {
  /** Nom affiché (« Alpha », « Terrasse rooftop »). */
  name: string;
  photo: VenuePhoto;
}

// Bureaux privés : une même taille regroupe plusieurs bureaux nommés (Alpha,
// Bêta, Gamma, Delta…). La carte montre le visuel de chacun ; les pastilles
// portent le nom du bureau, pour que la photo affichée corresponde toujours au
// bureau désigné.
export function OfficeGallery({ shots, sizes, className }: { shots: OfficeShot[]; sizes: string; className?: string }) {
  const [index, setIndex] = useState(0);
  const current = shots[index] ?? shots[0];
  if (!current) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900/5">
        {shots.map((shot, i) => (
          <Image
            key={shot.photo.src}
            src={shot.photo.src}
            alt={shot.photo.alt}
            fill
            sizes={sizes}
            className={cn('object-cover transition-opacity duration-300', i === index ? 'opacity-100' : 'opacity-0')}
            aria-hidden={i !== index}
          />
        ))}
        <figcaption className="absolute bottom-2.5 left-2.5 rounded-lg bg-white/92 px-2.5 py-1 text-xs font-semibold text-ink-900 shadow-soft backdrop-blur-sm">
          {current.name}
        </figcaption>
      </figure>
      {shots.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choisir le bureau à afficher">
          {shots.map((shot, i) => (
            <button
              key={shot.name}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              className={cn(
                'rounded-pill border px-3 py-1 text-xs font-semibold transition-colors',
                i === index ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/12 bg-white text-ink-700 hover:border-ink-900/40',
              )}
            >
              {shot.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
