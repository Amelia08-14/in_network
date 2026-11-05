'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MemberCard } from '@/components/features/MemberCard';
import { groupTagOptions, useTagOptions } from '@/components/features/TagPicker';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ApiRequestError } from '@/lib/api';
import type { ApiListResponse, MemberProfileSummary } from '@/types';

const MEMBER_TYPES = [
  { value: '', label: 'Tous les profils' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
];

// useSearchParams exige une frontière Suspense pour le rendu statique.
export default function AnnuairePage() {
  return (
    <Suspense>
      <Annuaire />
    </Suspense>
  );
}

function Annuaire() {
  // Recherche lancée depuis l'accueil : /annuaire?q=…
  const initialSearch = useSearchParams().get('q') ?? '';
  const [search, setSearch] = useState(initialSearch);
  const [memberType, setMemberType] = useState('');
  const [sector, setSector] = useState('');
  const [skill, setSkill] = useState('');
  // Requête lancée 300 ms après la dernière frappe (et non à chaque lettre).
  const [query, setQuery] = useState(initialSearch);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Brief client §4.3 — recherche avancée : filtre par secteur d'activité,
  // en plus du texte libre et du type de profil déjà en place.
  const { data: sectors } = useTagOptions('SECTOR');
  const { data: skills } = useTagOptions('SKILL');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['profiles', query, memberType, sector, skill],
    queryFn: () =>
      api.get<ApiListResponse<MemberProfileSummary>>(
        `/api/profiles?limit=48${query ? `&search=${encodeURIComponent(query)}` : ''}${
          memberType ? `&memberType=${memberType}` : ''
        }${sector ? `&tag=${encodeURIComponent(sector)}` : ''}${skill ? `&skill=${encodeURIComponent(skill)}` : ''}`,
      ),
  });

  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Annuaire"
        title={<>Annuaire des <span className="text-brand-orange">membres</span></>}
        description="Découvrez les entrepreneurs, freelances, startups et PME du réseau IN NETWORK, et envoyez vos demandes de mise en relation."
      />

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
          <Input
            placeholder="Nom, entreprise, poste, ville, compétence…"
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
        {sectors && sectors.length > 0 && (
          <Select aria-label="Domaine d’activité" value={sector} onChange={(e) => setSector(e.target.value)} className="sm:w-64">
            <option value="">Tous les domaines</option>
            {groupTagOptions(sectors).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
        {skills && skills.length > 0 && (
          <Select aria-label="Compétence proposée" value={skill} onChange={(e) => setSkill(e.target.value)} className="sm:w-64">
            <option value="">Toutes les compétences</option>
            {groupTagOptions(skills).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-ink-900/[0.07] bg-white p-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-ink-900/6" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded-sm bg-ink-900/6" />
                  <div className="h-3 w-1/2 rounded-sm bg-ink-900/6" />
                </div>
              </div>
              <div className="mt-4 h-3 w-1/3 rounded-sm bg-ink-900/6" />
            </div>
          ))}
        </div>
      ) : isError ? (
        // Une erreur (session expirée, coupure réseau) ne doit pas passer pour un annuaire vide.
        <EmptyState
          title="L’annuaire n’a pas pu être chargé"
          description={error instanceof ApiRequestError && error.status === 401 ? 'Votre session a expiré : reconnectez-vous pour consulter l’annuaire.' : 'Vérifiez votre connexion puis réessayez.'}
          action={
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RotateCcw className="h-4 w-4" /> Réessayer
            </Button>
          }
        />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="Aucun membre ne correspond à votre recherche"
          description={query || memberType || sector || skill ? 'Essayez avec moins de mots ou retirez un filtre.' : 'Les membres apparaissent ici une fois leur compte validé par l’équipe IN NETWORK.'}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-500">
            {data.meta.total} membre{data.meta.total > 1 ? 's' : ''}
            {data.meta.total > data.data.length ? ` · ${data.data.length} affichés, affinez la recherche pour voir les autres` : ''}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.data.map((profile) => (
              <MemberCard key={profile.id} profile={profile} />
            ))}
          </div>
        </>
      )}
    </Container>
  );
}
