'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';
import type { MemberProfileSummary } from '@/types';

export default function ProfilPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<{ data: MemberProfileSummary }>('/api/profiles/me').then((r) => r.data),
  });

  const [form, setForm] = useState({
    bio: '',
    jobTitle: '',
    companyName: '',
    website: '',
    linkedinUrl: '',
    skillsOffered: '',
    skillsWanted: '',
    sectors: '',
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        bio: profile.bio ?? '',
        jobTitle: profile.jobTitle ?? '',
        companyName: profile.companyName ?? '',
        website: profile.website ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        skillsOffered: (profile.skillsOffered ?? []).join(', '),
        skillsWanted: (profile.skillsWanted ?? []).join(', '),
        sectors: (profile.sectors ?? []).join(', '),
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/api/profiles/me', {
        bio: form.bio || null,
        jobTitle: form.jobTitle || null,
        companyName: form.companyName || null,
        website: form.website || null,
        linkedinUrl: form.linkedinUrl || null,
        skillsOffered: form.skillsOffered.split(',').map((s) => s.trim()).filter(Boolean),
        skillsWanted: form.skillsWanted.split(',').map((s) => s.trim()).filter(Boolean),
        sectors: form.sectors.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setMessage('Profil mis à jour.');
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (e) => setMessage(e instanceof ApiRequestError ? e.message : 'Erreur lors de la mise à jour'),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Chargement...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Mon profil</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ces informations apparaissent dans l'annuaire et alimentent le moteur de mise en relation.
        </p>
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Informations</CardTitle>
        </div>
        <CardContent className="pt-0">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
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
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input id="linkedinUrl" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
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
              <Label htmlFor="sectors">Secteur(s) d'activité (séparés par des virgules)</Label>
              <Input id="sectors" value={form.sectors} onChange={(e) => setForm({ ...form, sectors: e.target.value })} />
            </div>

            {message && <p className="text-sm text-brand-violet">{message}</p>}

            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
