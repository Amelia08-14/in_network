'use client';

import { useRef, useState } from 'react';
import { Film, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUpload, ApiRequestError } from '@/lib/admin-api';

export function VideoUploader({
  value,
  onChange,
  category,
  label = 'Vidéo',
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  category: 'events' | 'testimonials' | 'sites';
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus('uploading');
    setError(null);
    try {
      const { url } = await apiUpload(file, category);
      onChange(url);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiRequestError ? e.message : "Échec de l'envoi");
    }
  }

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium text-ink-700">{label}</p>}
      {value ? (
        <div className="space-y-2">
          <video src={value} controls className="w-full max-w-sm rounded-card bg-ink-900" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-orange"
          >
            <X className="h-3 w-3" /> Retirer
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card border border-dashed border-ink-900/20 bg-ink-900/[0.03]">
            {status === 'uploading' ? (
              <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
            ) : (
              <Film className="h-5 w-5 text-ink-500" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={status === 'uploading'}>
              Choisir un fichier vidéo
            </Button>
            {error && <p className="text-xs text-brand-orange">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
