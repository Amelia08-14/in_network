'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Linkedin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
  order: number;
}

// Formulaire commun création / modification (profil complet, demande cliente
// 04/11/2026). Les domaines d'intervention se saisissent un par ligne.
interface ExpertForm {
  displayName: string;
  expertiseArea: string;
  bio: string;
  photoUrl: string | null;
  linkedinUrl: string;
  location: string;
  languages: string;
  services: string;
  hourlyRate: string;
  isVerified: boolean;
}

const EMPTY_FORM: ExpertForm = { displayName: '', expertiseArea: '', bio: '', photoUrl: null, linkedinUrl: '', location: '', languages: '', services: '', hourlyRate: '', isVerified: false };

const toForm = (e: AdminExpert): ExpertForm => ({
  displayName: e.displayName,
  expertiseArea: e.expertiseArea,
  bio: e.bio ?? '',
  photoUrl: e.photoUrl,
  linkedinUrl: e.linkedinUrl ?? '',
  location: e.location ?? '',
  languages: e.languages ?? '',
  services: (e.servicesOffered ?? []).join('\n'),
  hourlyRate: e.hourlyRate ? String(Number(e.hourlyRate)) : '',
  isVerified: e.isVerified,
});

/** Corps envoyé à l'API : champ vide = effacé (null). */
const toPayload = (f: ExpertForm) => ({
  displayName: f.displayName.trim(),
  expertiseArea: f.expertiseArea.trim(),
  bio: f.bio.trim() || null,
  photoUrl: f.photoUrl || null,
  linkedinUrl: f.linkedinUrl.trim() ? (/^https?:\/\//i.test(f.linkedinUrl.trim()) ? f.linkedinUrl.trim() : `https://${f.linkedinUrl.trim()}`) : null,
  location: f.location.trim() || null,
  languages: f.languages.trim() || null,
  servicesOffered: f.services.split('\n').map((s) => s.trim()).filter(Boolean),
  hourlyRate: f.hourlyRate.trim() ? Number(f.hourlyRate.replace(/\s/g, '')) : null,
  isVerified: f.isVerified,
});

export default function AdminExpertsPage() {
  const queryClient = useQueryClient();
  // null = formulaire fermé ; 'new' = création ; sinon id de l'expert modifié.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ExpertForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: () => api.get<ApiListResponse<AdminExpert> | { data: AdminExpert[] }>('/api/admin/experts'),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-experts'] });
    queryClient.invalidateQueries({ queryKey: ['experts'] });
    revalidatePublic('experts');
  };

  const saveMutation = useMutation({
    mutationFn: () => (editing === 'new' ? api.post('/api/admin/experts', toPayload(form)) : api.patch(`/api/admin/experts/${editing}`, toPayload(form))),
    onSuccess: () => {
      refresh();
      setForm(EMPTY_FORM);
      setEditing(null);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Enregistrement impossible'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) => api.patch(`/api/admin/experts/${id}`, { isPublic }),
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/experts/${id}`),
    onSuccess: refresh,
  });

  const experts = (data?.data ?? []).filter((e) => e.displayName.toLowerCase().includes(search.trim().toLowerCase()));
  const missingLinkedin = (data?.data ?? []).filter((e) => !e.linkedinUrl).length;

  function open(target: AdminExpert | 'new') {
    setFormError(null);
    if (target === 'new') {
      setForm(EMPTY_FORM);
      setEditing('new');
    } else {
      setForm(toForm(target));
      setEditing(target.id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const set = (patch: Partial<ExpertForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink-900">Experts</h1>
          <p className="mt-1 text-sm text-ink-500">
            Profils publiés sur le site.{missingLinkedin > 0 && ` ${missingLinkedin} sans lien LinkedIn (affiché grisé).`}
          </p>
        </div>
        <Button size="sm" onClick={() => open('new')}>
          <Plus className="h-4 w-4" /> Nouvel expert
        </Button>
      </div>

      {editing && (
        <Card>
          <CardContent className="space-y-4">
            <p className="font-heading text-lg font-bold text-ink-900">{editing === 'new' ? 'Nouvel expert' : `Modifier ${form.displayName}`}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ex-name">Nom affiché *</Label>
                <Input id="ex-name" value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-area">Domaine d’expertise *</Label>
                <Input id="ex-area" value={form.expertiseArea} onChange={(e) => set({ expertiseArea: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ex-linkedin">Profil LinkedIn</Label>
                <Input id="ex-linkedin" inputMode="url" placeholder="https://www.linkedin.com/in/…" value={form.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value })} />
                <p className="mt-1 text-xs text-ink-500">Sans lien, le bouton LinkedIn reste visible sur le site mais grisé.</p>
              </div>
              <div>
                <Label htmlFor="ex-location">Ville</Label>
                <Input id="ex-location" placeholder="Ex. Alger" value={form.location} onChange={(e) => set({ location: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-languages">Langues</Label>
                <Input id="ex-languages" placeholder="Ex. Français, arabe, anglais" value={form.languages} onChange={(e) => set({ languages: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="ex-bio">Présentation</Label>
              <Textarea id="ex-bio" rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div>
                <Label htmlFor="ex-services">Domaines d’intervention (un par ligne)</Label>
                <Textarea id="ex-services" rows={4} placeholder={'Ex. Levée de fonds\nStratégie de croissance'} value={form.services} onChange={(e) => set({ services: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-rate">Tarif horaire (DA, facultatif)</Label>
                <Input id="ex-rate" inputMode="numeric" value={form.hourlyRate} onChange={(e) => set({ hourlyRate: e.target.value })} />
                <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" checked={form.isVerified} onChange={(e) => set({ isVerified: e.target.checked })} /> Expert vérifié
                </label>
              </div>
            </div>
            <ImageUploader value={form.photoUrl} onChange={(url) => set({ photoUrl: url })} category="experts" label="Photo" />

            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.displayName.trim() || !form.expertiseArea.trim()}>
                {saveMutation.isPending ? 'Enregistrement…' : editing === 'new' ? 'Ajouter l’expert' : 'Enregistrer'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input className="pl-9" placeholder="Rechercher un expert..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : experts.length === 0 ? (
            <EmptyState title={search ? 'Aucun expert ne correspond à la recherche' : 'Aucun expert'} />
          ) : (
            <div className="divide-y divide-ink-900/8">
              {experts.map((expert) => (
                <div key={expert.id} className="flex flex-wrap items-center gap-4 p-5">
                  <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-800">{expert.displayName}</p>
                    <p className="text-sm text-ink-500">{expert.expertiseArea}</p>
                  </div>
                  {expert.linkedinUrl ? (
                    <a href={expert.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                      <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Badge variant="neutral">LinkedIn manquant</Badge>
                  )}
                  {!expert.photoUrl && <Badge variant="startup">Photo manquante</Badge>}
                  <Badge variant={expert.isPublic ? 'success' : 'neutral'}>{expert.isPublic ? 'Publié' : 'Brouillon'}</Badge>
                  <Button size="sm" variant="outline" onClick={() => open(expert)}>
                    <Pencil className="h-4 w-4" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => publishMutation.mutate({ id: expert.id, isPublic: !expert.isPublic })}>
                    {expert.isPublic ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Supprimer ${expert.displayName}`}
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
