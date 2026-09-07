'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiUploadMine, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

// Uploader d'image en libre-service pour un membre connecté (logo d'entreprise,
// avatar) — passe par POST /api/uploads/me (requireAuth), contrairement à
// components/features/upload/ImageUploader.tsx qui vise l'endpoint admin.
export function MemberImageUploader({
  value,
  onChange,
  label = 'Image',
  hint,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus('uploading');
    setError(null);
    try {
      const { url } = await apiUploadMine(file);
      onChange(url);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiRequestError ? e.message : "Échec de l'envoi");
    }
  }

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-dashed border-ink-900/20 bg-ink-900/[0.03]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-ink-500" />
          )}
          {status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/50">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={status === 'uploading'}
          >
            {value ? 'Remplacer' : 'Choisir un fichier'}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-orange"
            >
              <X className="h-3 w-3" /> Retirer
            </button>
          )}
          {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
          {error && <p className="text-xs text-brand-orange">{error}</p>}
        </div>
      </div>
    </div>
  );
}
