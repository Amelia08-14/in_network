'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ImageUploader } from '@/components/features/upload/ImageUploader';
import { api, ApiRequestError } from '@/lib/admin-api';
import type { ApiListResponse, Partner } from '@/types';

interface AdminPartner extends Partner {
  isPublished: boolean;
}

const EMPTY_FORM = { name: '', sector: '', websiteUrl: '', description: '', logoUrl: null as string | null };

export default function AdminPartenairesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => api.get<ApiListResponse<AdminPartner> | { data: AdminPartner[] }>('/api/admin/partners'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/partners', {
        name: form.name,
        sector: form.sector,
        websiteUrl: form.websiteUrl || undefined,
        description: form.description || undefined,
        logoUrl: form.logoUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/api/admin/partners/${id}`, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-partners'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/partners/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-partners'] }),
  });

  const partners = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Partenaires</h1>
          <p className="mt-1 text-sm text-gray-500">Fiches partenaires publiées sur /partenaires.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nouveau partenaire
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nom</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Secteur d&apos;activité</Label>
                <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              </div>
              <div>
                <Label>Site web</Label>
                <Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <ImageUploader value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} category="partners" label="Logo" />

            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name || !form.sector || !form.logoUrl}>
                {createMutation.isPending ? 'Création...' : 'Ajouter le partenaire'}
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
          ) : partners.length === 0 ? (
            <EmptyState title="Aucun partenaire" />
          ) : (
            <div className="divide-y divide-gray-100">
              {partners.map((partner) => (
                <div key={partner.id} className="flex items-center gap-4 p-5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    <Image src={partner.logoUrl} alt="" fill sizes="44px" className="object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800">{partner.name}</p>
                    <p className="text-sm text-gray-500">{partner.sector}</p>
                  </div>
                  <Badge variant={partner.isPublished ? 'success' : 'neutral'}>
                    {partner.isPublished ? 'Publié' : 'Brouillon'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publishMutation.mutate({ id: partner.id, isPublished: !partner.isPublished })}
                  >
                    {partner.isPublished ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Supprimer ${partner.name} ?`)) deleteMutation.mutate(partner.id);
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
