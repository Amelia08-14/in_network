'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, Lock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiPostForm, ApiRequestError, openMemberFile } from '@/lib/api';
import type { IdDocumentInfo } from '@/types';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

// Pièce d'identité exigée pour un profil complet (demande client 27/10/2026).
// Envoyée tout de suite, indépendamment du bouton « Enregistrer » du profil ;
// le fichier reste privé (lu par le membre et l'équipe IN NETWORK seulement).
export function IdDocumentUploader({ document }: { document: IdDocumentInfo | null | undefined }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiPostForm('/api/profiles/me/id-document', formData);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : 'Envoi impossible, réessayez.'),
  });

  function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('Le fichier dépasse 10 Mo.');
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Formats acceptés : PDF, JPG, PNG ou WebP.');
      return;
    }
    upload.mutate(file);
  }

  const uploadedAt = document?.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">
        Joignez le scan ou une photo lisible d’une pièce d’identité en cours de validité (carte nationale d’identité, passeport ou permis de conduire), recto et verso si besoin.
      </p>
      {document ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-green/40 bg-accent-green/[0.08] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold text-ink-900">{document.fileName ?? 'Pièce d’identité'}</p>
            {uploadedAt && <p className="text-ink-500">Envoyée le {uploadedAt}</p>}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => openMemberFile('/api/profiles/me/id-document').catch(() => setError('Impossible d’ouvrir le document.'))}>
            <Eye className="h-4 w-4" /> Voir
          </Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-brand-orange/40 bg-brand-orange/[0.05] px-4 py-3 text-sm font-medium text-brand-orange">
          Aucune pièce d’identité envoyée : votre profil ne peut pas être complet sans elle.
        </p>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" id="id-document" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={document ? 'outline' : 'primary'} disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> {upload.isPending ? 'Envoi…' : document ? 'Remplacer le document' : 'Envoyer ma pièce d’identité'}
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <Lock className="h-3.5 w-3.5" /> Document privé, visible uniquement par vous et l’équipe IN NETWORK. PDF, JPG, PNG ou WebP, 10 Mo max.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand-orange">
          {error}
        </p>
      )}
    </div>
  );
}
