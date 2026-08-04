'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { VideoUploader } from '@/components/features/upload/VideoUploader';
import { api, ApiRequestError } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string | null;
  content: string | null;
  videoUrl: string | null;
  isPublished: boolean;
}

const EMPTY_FORM = { authorName: '', authorRole: '', content: '', videoUrl: null as string | null };

export default function AdminTemoignagesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-testimonials'],
    queryFn: () => api.get<ApiListResponse<Testimonial> | { data: Testimonial[] }>('/api/admin/testimonials'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/testimonials', {
        authorName: form.authorName,
        authorRole: form.authorRole || undefined,
        content: form.content || undefined,
        videoUrl: form.videoUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/api/admin/testimonials/${id}`, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/testimonials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] }),
  });

  const testimonials = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Témoignages</h1>
          <p className="mt-1 text-sm text-gray-500">Avis de membres publiés sur le site.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nouveau témoignage
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nom</Label>
                <Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
              </div>
              <div>
                <Label>Rôle</Label>
                <Input value={form.authorRole} onChange={(e) => setForm({ ...form, authorRole: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Témoignage (optionnel si vidéo)</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <VideoUploader
              category="testimonials"
              value={form.videoUrl}
              onChange={(url) => setForm({ ...form, videoUrl: url })}
              label="Vidéo du témoignage (optionnel)"
            />
            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.authorName || (!form.content && !form.videoUrl)}
              >
                {createMutation.isPending ? 'Création...' : 'Ajouter'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : testimonials.length === 0 ? (
            <EmptyState title="Aucun témoignage" />
          ) : (
            <div className="divide-y divide-gray-100">
              {testimonials.map((t) => (
                <div key={t.id} className="flex items-start gap-4 p-5">
                  {t.videoUrl && (
                    <video src={t.videoUrl} className="h-16 w-16 shrink-0 rounded-card bg-ink-900 object-cover" muted playsInline />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800">
                      {t.authorName} {t.authorRole && <span className="font-normal text-gray-500">— {t.authorRole}</span>}
                    </p>
                    {t.content && <p className="mt-1 text-sm text-gray-600">{t.content}</p>}
                    {t.videoUrl && <p className="mt-1 text-xs font-medium text-brand-blue">Vidéo jointe</p>}
                  </div>
                  <Badge variant={t.isPublished ? 'success' : 'neutral'}>{t.isPublished ? 'Publié' : 'Brouillon'}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publishMutation.mutate({ id: t.id, isPublished: !t.isPublished })}
                  >
                    {t.isPublished ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Supprimer le témoignage de ${t.authorName} ?`)) deleteMutation.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-brand-orange" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
