'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ImageUploader } from '@/components/features/upload/ImageUploader';
import { api } from '@/lib/admin-api';
import type { GalleryImageItem } from '@/types';

interface Site {
  id: string;
  name: string;
}

// Galerie du lieu (locaux/équipe) — alimente la section "espace" de la home
// du site public dès que de vraies photos sont envoyées ici.
export default function AdminGaleriePage() {
  const queryClient = useQueryClient();

  const { data: sites } = useQuery({
    queryKey: ['admin-sites'],
    queryFn: () => api.get<{ data: Site[] }>('/api/sites').then((r) => r.data),
  });
  const site = sites?.[0];

  const { data: images, isLoading } = useQuery({
    queryKey: ['admin-site-images', site?.id],
    queryFn: () => api.get<{ data: GalleryImageItem[] }>(`/api/admin/sites/${site!.id}/images`).then((r) => r.data),
    enabled: Boolean(site),
  });

  const addMutation = useMutation({
    mutationFn: (url: string) =>
      api.post(`/api/admin/sites/${site!.id}/images`, { url, order: images?.length ?? 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-site-images', site?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => api.delete(`/api/admin/sites/${site!.id}/images/${imageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-site-images', site?.id] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Galerie du lieu</h1>
        <p className="mt-1 text-sm text-gray-500">
          {site ? `Photos de ${site.name} — affichées sur la page d'accueil du site.` : 'Chargement du lieu...'}
        </p>
      </div>

      {site && (
        <Card>
          <CardContent>
            <ImageUploader
              value={null}
              onChange={(url) => url && addMutation.mutate(url)}
              category="sites"
              label="Ajouter une photo"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : !images || images.length === 0 ? (
            <EmptyState title="Aucune photo pour le moment" description="Ajoute la première photo réelle du lieu ci-dessus." className="py-12" />
          ) : (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <div key={image.id} className="group relative aspect-square overflow-hidden rounded-card bg-gray-100">
                  <Image src={image.url} alt={image.altText ?? ''} fill sizes="200px" className="object-cover" />
                  <button
                    onClick={() => deleteMutation.mutate(image.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
