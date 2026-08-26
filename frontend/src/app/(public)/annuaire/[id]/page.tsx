'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, CheckCircle2, Globe2, Linkedin, Mail, MessageCircle } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Badge, MemberTypeBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MemberProfileSummary } from '@/types';

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, status } = useAuthStore();
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Bonjour, votre profil m'intéresse et je souhaiterais échanger avec vous dans le cadre du réseau IN NETWORK.");

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', params.id],
    queryFn: () => api.get<{ data: MemberProfileSummary }>(`/api/profiles/${params.id}`).then((response) => response.data),
  });

  const requestMutation = useMutation({
    mutationFn: () => api.post('/api/connections/requests', { toUserId: profile?.userId, message }),
    onSuccess: () => {
      setSent(true);
      setIsRequestOpen(false);
    },
    onError: (requestError) => setError(requestError instanceof ApiRequestError ? requestError.message : "Impossible d'envoyer la demande."),
  });

  if (isLoading) return <Container className="py-20"><p className="text-sm text-ink-500">Chargement du profil...</p></Container>;
  if (!profile) return <Container className="py-20"><p className="text-ink-600">Profil introuvable.</p></Container>;

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`;

  return (
    <Container className="max-w-4xl py-12 md:py-20">
      <Link href="/annuaire" className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;annuaire
      </Link>

      <Card className="mt-6 overflow-hidden">
        <div className="h-24 bg-ink-900" />
        <CardContent className="relative px-6 pb-7 md:px-8">
          <div className="-mt-14 flex flex-col items-start gap-5 sm:flex-row sm:items-end">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-linear-to-br from-ink-900 to-brand-orange text-3xl font-bold text-white shadow-soft">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-bold text-ink-900">{profile.firstName} {profile.lastName}</h1>
                <MemberTypeBadge memberType={profile.memberType} />
              </div>
              {profile.jobTitle && <p className="mt-1 text-lg font-medium text-brand-blue">{profile.jobTitle}</p>}
              {profile.companyName && <p className="mt-1 flex items-center gap-2 text-sm text-ink-500"><Building2 className="h-4 w-4" /> {profile.companyName}</p>}
            </div>
          </div>

          {profile.bio && <p className="mt-7 whitespace-pre-line text-base leading-relaxed text-ink-600">{profile.bio}</p>}

          <div className="mt-7 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">Compétences proposées</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skillsOffered?.length ? profile.skillsOffered.map((skill) => <Badge key={skill} variant="success">{skill}</Badge>) : <span className="text-sm text-ink-500">Non renseignées</span>}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">Compétences recherchées</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skillsWanted?.length ? profile.skillsWanted.map((skill) => <Badge key={skill} variant="neutral">{skill}</Badge>) : <span className="text-sm text-ink-500">Non renseignées</span>}
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-ink-900/8 pt-6">
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Globe2 className="h-4 w-4" /> Site web</a>}
            {profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Linkedin className="h-4 w-4" /> LinkedIn</a>}
            {profile.email && <a href={`mailto:${profile.email}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Mail className="h-4 w-4" /> Email</a>}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {sent ? (
          <div className="flex items-center gap-3 rounded-2xl bg-accent-green/15 p-4 text-sm font-medium text-green-800">
            <CheckCircle2 className="h-5 w-5" /> Demande de mise en relation envoyée.
          </div>
        ) : status === 'unauthenticated' ? (
          <Link href={`/login?redirect=/annuaire/${profile.id}`} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
            Se connecter pour demander une mise en relation
          </Link>
        ) : user && profile.userId === user.id ? null : !isRequestOpen ? (
          <Button variant="primary" size="lg" onClick={() => setIsRequestOpen(true)}>
            <MessageCircle className="h-5 w-5" /> Demander une mise en relation
          </Button>
        ) : (
          <Card className="max-w-xl">
            <CardContent>
              <Label htmlFor="networking-message">Message professionnel</Label>
              <Textarea id="networking-message" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} />
              {error && <p className="mt-2 text-sm text-brand-orange">{error}</p>}
              <div className="mt-4 flex gap-3">
                <Button variant="primary" disabled={!message.trim() || requestMutation.isPending} onClick={() => requestMutation.mutate()}>
                  {requestMutation.isPending ? 'Envoi...' : 'Envoyer la demande'}
                </Button>
                <Button variant="ghost" onClick={() => setIsRequestOpen(false)}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}
