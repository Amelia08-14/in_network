'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, UploadCloud } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api, apiUploadMine, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MemberProfileSummary } from '@/types';

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function profileErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.';
  }
  const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
  const labels: Record<string, string> = {
    bio: 'Bio',
    jobTitle: 'Poste / activité',
    companyName: 'Entreprise',
    companyLogoUrl: 'Logo de l’entreprise',
    website: 'Site web',
    linkedinUrl: 'LinkedIn',
    skillsOffered: 'Compétences proposées',
    skillsWanted: 'Compétences recherchées',
    sectors: 'Secteurs d’activité',
  };
  const invalidField = Object.entries(details?.fieldErrors ?? {}).find(([, messages]) => messages?.length);
  if (invalidField) {
    const [field, messages] = invalidField;
    return `${labels[field] ?? field} : ${messages[0]}`;
  }
  if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour enregistrer le profil.';
  if (error.status === 403) return 'Vous n’avez pas l’autorisation de modifier ce profil.';
  if (error.status === 404) return 'Ce profil n’existe plus ou n’est plus accessible.';
  if (error.status === 409) return error.message || 'Ces informations sont déjà utilisées.';
  if (error.status === 429) return 'Trop de tentatives. Patientez quelques instants puis réessayez.';
  if (error.status >= 500) return 'Le serveur n’a pas pu enregistrer le profil. Réessayez dans quelques instants.';
  return error.message;
}

export default function ProfilPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<{ data: MemberProfileSummary }>('/api/profiles/me').then((r) => r.data),
  });

  if (isLoading || !profile) return <p className="text-sm text-ink-500">Chargement...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Mon profil</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ces informations apparaissent dans l&apos;annuaire et alimentent le moteur de mise en relation.
        </p>
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Informations</CardTitle>
        </div>
        <CardContent className="pt-0">
          {/* Remonté à chaque changement de version du profil : l'état du
              formulaire est initialisé depuis les props (pas de setState en
              effet). */}
          <ProfilForm key={profile.updatedAt ?? profile.id} profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfilForm({ profile }: { profile: MemberProfileSummary }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    bio: profile.bio ?? '',
    jobTitle: profile.jobTitle ?? '',
    companyName: profile.companyName ?? '',
    website: profile.website ?? '',
    linkedinUrl: profile.linkedinUrl ?? '',
    skillsOffered: (profile.skillsOffered ?? []).join(', '),
    skillsWanted: (profile.skillsWanted ?? []).join(', '),
    sectors: (profile.sectors ?? []).join(', '),
  });
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(profile.companyLogoUrl ?? null);
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const logoUpload = useMutation({
    mutationFn: (file: File) => apiUploadMine(file),
    onSuccess: ({ url }) => {
      setCompanyLogoUrl(url);
      setMessage({ text: 'Logo téléversé. Cliquez sur « Enregistrer » pour le publier.', kind: 'success' });
    },
    onError: (e) => setMessage({ text: profileErrorMessage(e), kind: 'error' }),
  });

  function handleLogoFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Le logo doit être un fichier image (PNG, JPG, SVG...).', kind: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: 'Le logo ne doit pas dépasser 10 Mo.', kind: 'error' });
      return;
    }
    logoUpload.mutate(file);
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/api/profiles/me', {
        bio: form.bio || null,
        jobTitle: form.jobTitle || null,
        companyName: form.companyName || null,
        companyLogoUrl: companyLogoUrl || null,
        website: normalizeUrl(form.website) || null,
        linkedinUrl: normalizeUrl(form.linkedinUrl) || null,
        skillsOffered: form.skillsOffered.split(',').map((s) => s.trim()).filter(Boolean),
        skillsWanted: form.skillsWanted.split(',').map((s) => s.trim()).filter(Boolean),
        sectors: form.sectors.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setForm((current) => ({
        ...current,
        website: normalizeUrl(current.website),
        linkedinUrl: normalizeUrl(current.linkedinUrl),
      }));
      setMessage({ text: 'Profil mis à jour.', kind: 'success' });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (e) => setMessage({ text: profileErrorMessage(e), kind: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div>
        <Label>Logo de l&apos;entreprise</Label>
        <p className="mt-0.5 text-xs text-ink-500">
          Affiché sur votre fiche dans l&apos;annuaire. PNG, JPG ou SVG, 10 Mo maximum.
        </p>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-900/15 bg-ink-900/5">
            {companyLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyLogoUrl} alt="Logo de l'entreprise" className="h-full w-full object-contain" />
            ) : (
              <UploadCloud className="h-6 w-6 text-ink-400" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleLogoFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={logoUpload.isPending}
              onClick={() => logoInputRef.current?.click()}
            >
              {logoUpload.isPending
                ? 'Téléversement...'
                : companyLogoUrl
                  ? 'Remplacer le logo'
                  : 'Ajouter un logo'}
            </Button>
            {companyLogoUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={logoUpload.isPending}
                onClick={() => setCompanyLogoUrl(null)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Retirer
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="jobTitle">Poste / activité</Label>
          <Input id="jobTitle" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="companyName">Entreprise</Label>
          <Input id="companyName" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="website">Site web</Label>
          <Input id="website" inputMode="url" placeholder="https://exemple.dz" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="linkedinUrl">LinkedIn</Label>
          <Input id="linkedinUrl" inputMode="url" placeholder="https://linkedin.com/in/votre-profil" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="skillsOffered">Compétences proposées (séparées par des virgules)</Label>
        <Input id="skillsOffered" value={form.skillsOffered} onChange={(e) => setForm({ ...form, skillsOffered: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="skillsWanted">Compétences recherchées (séparées par des virgules)</Label>
        <Input id="skillsWanted" value={form.skillsWanted} onChange={(e) => setForm({ ...form, skillsWanted: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="sectors">Secteur(s) d&apos;activité (séparés par des virgules)</Label>
        <Input id="sectors" value={form.sectors} onChange={(e) => setForm({ ...form, sectors: e.target.value })} />
      </div>

      {message && (
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm',
            message.kind === 'success' ? 'text-accent-green' : 'text-brand-orange',
          )}
        >
          {message.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {message.text}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </form>
  );
}
