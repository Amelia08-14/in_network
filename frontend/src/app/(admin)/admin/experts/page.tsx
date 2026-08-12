'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { ImageUploader } from '@/components/features/upload/ImageUploader';
import { api, ApiRequestError } from '@/lib/admin-api';
import { revalidatePublic } from '@/lib/revalidate-public';
import type { ApiListResponse, ExpertSummary } from '@/types';

interface AdminExpert extends ExpertSummary {
  isPublic: boolean;
}

const EMPTY_FORM = { displayName: '', expertiseArea: '', bio: '', photoUrl: null as string | null };

export default function AdminExpertsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: () => api.get<ApiListResponse<AdminExpert> | { data: AdminExpert[] }>('/api/admin/experts'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/experts', {
        displayName: form.displayName,
        expertiseArea: form.expertiseArea,
        bio: form.bio || undefined,
        photoUrl: form.photoUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-experts'] });
      queryClient.invalidateQueries({ queryKey: ['experts'] });
      revalidatePublic('experts');
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.patch(`/api/admin/experts/${id}`, { isPublic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-experts'] });
      revalidatePublic('experts');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/experts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-experts'] });
      revalidatePublic('experts');
    },
  });

  const experts = (data?.data ?? []).filter((e) => e.displayName.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Experts</h1>
          <p className="mt-1 text-sm text-gray-500">Annuaire d&apos;experts publié sur le site.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nouvel expert
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nom affiché</Label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
              <div>
                <Label>Domaine d&apos;expertise</Label>
                <Input value={form.expertiseArea} onChange={(e) => setForm({ ...form, expertiseArea: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <ImageUploader value={form.photoUrl} onChange={(url) => setForm({ ...form, photoUrl: url })} category="experts" label="Photo" />

            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.displayName || !form.expertiseArea}>
                {createMutation.isPending ? 'Création...' : "Ajouter l'expert"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Rechercher un expert..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : experts.length === 0 ? (
            <EmptyState title={search ? 'Aucun expert ne correspond à la recherche' : 'Aucun expert'} />
          ) : (
            <div className="divide-y divide-gray-100">
              {experts.map((expert) => (
                <div key={expert.id} className="flex items-center gap-4 p-5">
                  <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800">{expert.displayName}</p>
                    <p className="text-sm text-gray-500">{expert.expertiseArea}</p>
                  </div>
                  {!expert.photoUrl && <Badge variant="startup">Photo manquante</Badge>}
                  <Badge variant={expert.isPublic ? 'success' : 'neutral'}>
                    {expert.isPublic ? 'Publié' : 'Brouillon'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publishMutation.mutate({ id: expert.id, isPublic: !expert.isPublic })}
                  >
                    {expert.isPublic ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Supprimer ${expert.displayName} ?`)) deleteMutation.mutate(expert.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-brand-orange" />
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
