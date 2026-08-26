'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { GalleryImageItem } from '@/types';

export function ImageGallery({ images }: { images: GalleryImageItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-4/3 overflow-hidden rounded-card bg-ink-900/5"
          >
            <Image
              src={image.url}
              alt={image.altText ?? ''}
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-4 animate-fade-in"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setOpenIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-[80vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[openIndex].url}
              alt={images[openIndex].altText ?? ''}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
