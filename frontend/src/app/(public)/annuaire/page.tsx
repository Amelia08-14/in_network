'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MemberCard } from '@/components/features/MemberCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import type { ApiListResponse, MemberProfileSummary } from '@/types';

const MEMBER_TYPES = [
  { value: '', label: 'Tous les profils' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'PME', label: 'PME' },
  { value: 'DIASPORA', label: 'Diaspora' },
];

export default function AnnuairePage() {
  const [search, setSearch] = useState('');
  const [memberType, setMemberType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['profiles', search, memberType],
    queryFn: () =>
      api.get<ApiListResponse<MemberProfileSummary>>(
        `/api/profiles?limit=24${search ? `&search=${encodeURIComponent(search)}` : ''}${
          memberType ? `&memberType=${memberType}` : ''
        }`,
      ),
  });

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Annuaire"
        title={<>Annuaire des <span className="text-brand-orange">membres</span></>}
        description="Découvre les entrepreneurs, freelances, startups et PME du réseau IN NETWORK. Connecte-toi pour accéder aux profils complets et envoyer des demandes de mise en relation."
      />

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
          <Input
            placeholder="Rechercher un nom, une entreprise..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={memberType} onChange={(e) => setMemberType(e.target.value)} className="sm:w-56">
          {MEMBER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement de l'annuaire...</p>
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Aucun membre ne correspond à ta recherche" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.data.map((profile) => (
            <MemberCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </Container>
  );
}
