'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUpload, ApiRequestError } from '@/lib/admin-api';

interface QueueItem {
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// Sélection multiple (images + vidéos mélangées) — chaque fichier est envoyé
// l'un après l'autre (pas en parallèle, pour rester raisonnable niveau
// mémoire/bande passante sur le VPS avec des vidéos de plusieurs dizaines de
// MB) ; onUploaded est appelé après CHAQUE succès, pas seulement à la fin,
// pour que la galerie se peuple au fur et à mesure.
export function GalleryBulkUploader({
  onUploaded,
  category,
}: {
  onUploaded: (url: string) => void | Promise<void>;
  category: 'events' | 'sites';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFiles(files: FileList) {
    const items = Array.from(files).map((f) => ({ name: f.name, status: 'pending' as const }));
    setQueue(items);
    setIsUploading(true);

    const fileArray = Array.from(files);
    for (let i = 0; i < fileArray.length; i++) {
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: 'uploading' } : item)));
      try {
        const { url } = await apiUpload(fileArray[i], category);
        await onUploaded(url);
        setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item)));
      } catch (e) {
        const message = e instanceof ApiRequestError ? e.message : "Échec de l'envoi";
        setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: 'error', error: message } : item)));
      }
    }
    setIsUploading(false);
  }

  const doneCount = queue.filter((q) => q.status === 'done').length;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isUploading ? `Envoi... (${doneCount}/${queue.length})` : 'Ajouter des photos/vidéos (plusieurs à la fois)'}
      </Button>

      {queue.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {queue.map((item, i) => (
            <li key={`${item.name}-${i}`} className="flex items-center gap-2 text-ink-600">
              <span
                className={
                  item.status === 'done'
                    ? 'text-accent-green'
                    : item.status === 'error'
                      ? 'text-brand-orange'
                      : 'text-ink-500'
                }
              >
                {item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : item.status === 'uploading' ? '…' : '·'}
              </span>
              <span className="truncate">{item.name}</span>
              {item.error && <span className="text-brand-orange">— {item.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
