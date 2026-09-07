'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import type { MemberProfileSummary } from '@/types';

// Rappel de complétion de profil (demande client 07/09/2026) : visible sur
// tout l'espace membre tant que le profil est incomplet. Le backend refuse
// en parallèle les actions engageantes (code PROFILE_INCOMPLETE).
export function ProfileCompletionBanner() {
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<{ data: MemberProfileSummary }>('/api/profiles/me').then((r) => r.data),
  });

  const completeness = profile?.completeness;
  if (!completeness || completeness.isComplete) return null;

  return (
    <div className="mb-6 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold text-ink-900">Complétez votre profil</p>
          <p className="mt-1 text-sm text-ink-600">
            Il vous manque : {completeness.missing.join(', ')}. Un profil complet est requis pour souscrire à une
            formule, envoyer une demande, réserver un espace ou demander une mise en relation.
          </p>
          <Link
            href="/dashboard/profil"
            className="mt-2 inline-block text-sm font-semibold text-brand-orange hover:underline"
          >
            Compléter mon profil →
          </Link>
        </div>
      </div>
    </div>
  );
}
