'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Briefcase, Check, CheckCircle2, Circle, Contact, Handshake, ShoppingBag, UserRound, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TagPicker } from '@/components/features/TagPicker';
import { ChangePasswordCard } from '@/components/features/ChangePasswordCard';
import { MemberImageUploader } from '@/components/features/upload/MemberImageUploader';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MemberProfileSummary } from '@/types';

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  bio: 'Présentation',
  jobTitle: 'Poste / activité',
  companyName: 'Entreprise',
  companyLogoUrl: 'Logo de l’entreprise',
  avatarUrl: 'Photo',
  city: 'Ville',
  phone: 'Téléphone',
  website: 'Site web',
  linkedinUrl: 'LinkedIn',
  skillsOffered: 'Compétences proposées',
  skillsWanted: 'Compétences recherchées',
  sectors: 'Domaines d’activité',
};

function profileErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.';
  }
  const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
  const invalidField = Object.entries(details?.fieldErrors ?? {}).find(([, messages]) => messages?.length);
  if (invalidField) {
    const [field, messages] = invalidField;
    return `${FIELD_LABELS[field] ?? field} : ${messages[0]}`;
  }
  if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour enregistrer le profil.';
  if (error.status === 403) return 'Vous n’avez pas l’autorisation de modifier ce profil.';
  if (error.status === 404) return 'Ce profil n’existe plus ou n’est plus accessible.';
  if (error.status === 409) return error.message || 'Ces informations sont déjà utilisées.';
  if (error.status === 429) return 'Trop de tentatives. Patientez quelques instants puis réessayez.';
  if (error.status >= 500) return 'Le serveur n’a pas pu enregistrer le profil. Réessayez dans quelques instants.';
  return error.message;
}

function Section({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900/8 text-ink-800">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-ink-900">{title}</h2>
            {description && <p className="text-sm text-ink-500">{description}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function ProfilPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<{ data: MemberProfileSummary }>('/api/profiles/me').then((r) => r.data),
  });

  if (isLoading || !profile) return <p className="text-sm text-ink-500">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Mon profil</h1>
        <p className="mt-1 text-sm text-ink-500">
          Votre fiche apparaît dans l&apos;annuaire et alimente le moteur de mise en relation. Plus elle est complète, plus les rencontres sont pertinentes.
        </p>
      </div>
      {/* Remonté à chaque nouvelle version du profil : l'état du formulaire est initialisé depuis les props. */}
      <ProfilForm key={profile.updatedAt ?? profile.id} profile={profile} />
    </div>
  );
}

function ProfilForm({ profile }: { profile: MemberProfileSummary }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    memberType: profile.memberType,
    city: profile.city ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    jobTitle: profile.jobTitle ?? '',
    companyName: profile.companyName ?? '',
    website: profile.website ?? '',
    linkedinUrl: profile.linkedinUrl ?? '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl ?? null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(profile.companyLogoUrl ?? null);
  const [skillsOffered, setSkillsOffered] = useState<string[]>(profile.skillsOffered ?? []);
  const [skillsWanted, setSkillsWanted] = useState<string[]>(profile.skillsWanted ?? []);
  const [sectors, setSectors] = useState<string[]>(profile.sectors ?? []);
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Éléments exigés pour un profil complet (mêmes critères que l'API : profiles.service.ts).
  const checklist = [
    { label: 'Poste / activité', done: Boolean(form.jobTitle.trim()) },
    { label: 'Entreprise', done: Boolean(form.companyName.trim()) },
    { label: 'Présentation', done: Boolean(form.bio.trim()) },
    { label: 'Téléphone', done: Boolean(form.phone.trim()) },
    { label: 'Au moins un domaine d’activité', done: sectors.length > 0 },
  ];
  const bonus = [avatarUrl, form.city.trim(), form.linkedinUrl.trim(), skillsOffered.length, skillsWanted.length].filter(Boolean).length;
  const doneCount = checklist.filter((c) => c.done).length;
  const percent = Math.round(((doneCount + bonus) / (checklist.length + 5)) * 100);

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/api/profiles/me', {
        firstName: form.firstName,
        lastName: form.lastName,
        memberType: form.memberType,
        city: form.city || null,
        phone: form.phone || null,
        bio: form.bio || null,
        jobTitle: form.jobTitle || null,
        companyName: form.companyName || null,
        avatarUrl,
        companyLogoUrl,
        website: normalizeUrl(form.website) || null,
        linkedinUrl: normalizeUrl(form.linkedinUrl) || null,
        skillsOffered,
        skillsWanted,
        sectors,
      }),
    onSuccess: () => {
      setMessage({ text: 'Profil enregistré.', kind: 'success' });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (e) => setMessage({ text: profileErrorMessage(e), kind: 'error' }),
  });

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            mutation.mutate();
          }}
        >
          <Section icon={UserRound} title="Identité" description="Comment les autres membres vous voient.">
            <MemberImageUploader label="Photo de profil" value={avatarUrl} onChange={setAvatarUrl} hint="Un visage inspire confiance. PNG ou JPG." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" required value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" required value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="memberType">Type de profil</Label>
                <Select id="memberType" value={form.memberType} onChange={(e) => set({ memberType: e.target.value as MemberProfileSummary['memberType'] })}>
                  <option value="FREELANCE">Freelance / indépendant·e</option>
                  <option value="STARTUP">Startup</option>
                  <option value="ENTREPRISE">Entreprise</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="city">Ville / wilaya</Label>
                <Input id="city" placeholder="Ex. Alger" value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </div>
            </div>
          </Section>

          <Section icon={Contact} title="Coordonnées" description="Email et téléphone ne sont visibles que des membres avec qui vous êtes en relation.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email du compte</Label>
                <Input id="email" value={profile.email ?? ''} readOnly disabled className="bg-ink-900/[0.04]" />
                <p className="mt-1 text-xs text-ink-500">C&apos;est votre identifiant de connexion.</p>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone *</Label>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+213 5 00 00 00 00" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                <p className="mt-1 text-xs text-ink-500">Obligatoire pour commander, réserver ou demander une mise en relation.</p>
              </div>
              <div>
                <Label htmlFor="website">Site web</Label>
                <Input id="website" inputMode="url" placeholder="https://exemple.dz" value={form.website} onChange={(e) => set({ website: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input id="linkedinUrl" inputMode="url" placeholder="https://linkedin.com/in/votre-profil" value={form.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value })} />
              </div>
            </div>
          </Section>

          <Section icon={Briefcase} title="Activité" description="Votre poste, votre entreprise et votre présentation.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="jobTitle">Poste / activité *</Label>
                <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="companyName">Entreprise *</Label>
                <Input id="companyName" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
              </div>
            </div>
            <MemberImageUploader label="Logo de l’entreprise" value={companyLogoUrl} onChange={setCompanyLogoUrl} hint="Affiché sur votre fiche dans l’annuaire. PNG, JPG ou SVG." />
            <div>
              <Label htmlFor="bio">Présentation *</Label>
              <Textarea id="bio" rows={5} maxLength={2000} value={form.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Qui êtes-vous, ce que vous faites, ce que vous cherchez dans le réseau…" />
              <p className="mt-1 text-right text-xs text-ink-400">{form.bio.length} / 2000</p>
            </div>
          </Section>

          <Section icon={Wrench} title="Compétences et domaines" description="Ces choix alimentent le moteur de mise en relation : soyez précis.">
            <TagPicker label="Domaine(s) d’activité *" category="SECTOR" value={sectors} onChange={setSectors} max={10} tone="ink" placeholder="Ex. Services numériques, Commerce de détail, BTP…" />
            <TagPicker label="Compétences proposées" category="SKILL" value={skillsOffered} onChange={setSkillsOffered} max={20} tone="orange" hint="Ce que vous savez faire et pouvez apporter aux autres membres." placeholder="Ex. Développement Web, Comptabilité, Design UI/UX…" />
            <TagPicker label="Compétences recherchées" category="SKILL" value={skillsWanted} onChange={setSkillsWanted} max={20} tone="blue" hint="Ce que vous cherchez chez un partenaire, un prestataire ou une recrue." placeholder="Ex. Marketing Digital, Droit des affaires, Levée de fonds…" />
          </Section>

          <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-4 rounded-2xl border border-ink-900/10 bg-white/95 p-4 shadow-soft-lg backdrop-blur md:bottom-4">
            <Button type="submit" variant="primary" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer mon profil'}
            </Button>
            {message && (
              <p role={message.kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-1.5 text-sm', message.kind === 'success' ? 'text-green-700' : 'text-brand-orange')}>
                {message.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {message.text}
              </p>
            )}
          </div>
        </form>

        <ChangePasswordCard client={api} />
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <Card accent={doneCount === checklist.length ? 'green' : 'orange'}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-bold text-ink-900">Complétion du profil</h2>
              <span className="font-heading text-2xl font-bold tabular-nums text-ink-900">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-900/8">
              <div className={cn('h-full rounded-full transition-all', doneCount === checklist.length ? 'bg-accent-green' : 'bg-brand-orange')} style={{ width: `${percent}%` }} />
            </div>
            <ul className="space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className={cn('flex items-center gap-2', item.done ? 'text-ink-500' : 'font-medium text-ink-900')}>
                  {item.done ? <Check className="h-4 w-4 text-green-700" /> : <Circle className="h-4 w-4 text-brand-orange" />}
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-500">
              {doneCount === checklist.length
                ? 'Profil complet : vous pouvez commander, réserver et demander des mises en relation. Photo, ville, LinkedIn et compétences le rendent plus convaincant.'
                : 'Les éléments en gras sont exigés pour commander un service, réserver ou demander une mise en relation.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1.5">
            <h2 className="mb-2 font-heading text-base font-bold text-ink-900">Depuis votre espace</h2>
            {[
              { href: '/dashboard/catalogue', icon: ShoppingBag, label: 'Demander un service', hint: 'Catalogue, offres et abonnements' },
              { href: '/dashboard/networking', icon: Handshake, label: 'Mes mises en relation', hint: 'Suggestions et demandes' },
              { href: `/annuaire/${profile.id}`, icon: BadgeCheck, label: 'Voir ma fiche annuaire', hint: 'Ce que voient les autres membres' },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink-900/[0.04]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                  <link.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{link.label}</span>
                  <span className="block text-xs text-ink-500">{link.hint}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
