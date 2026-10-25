'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { OFFER_OPTIONS } from '@/lib/crm';

// Options réglées par le super administrateur (Paramètres › Listes et menu) :
// listes de choix du site et du dashboard, rubriques du menu masquées.
// Lecture publique (GET /api/options) ; tant qu'elles chargent, les listes
// retombent sur les valeurs historiques du code.

export interface PlatformOptions {
  lists: {
    contactSubjects: string[];
    leadOffers: string[];
    lostReasons: string[];
  };
  hiddenModules: string[];
}

export function usePlatformOptions() {
  return useQuery({
    queryKey: ['platform-options'],
    queryFn: () => api.get<{ data: PlatformOptions }>('/api/options').then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Offres vers lesquelles orienter un prospect (CRM). */
export function useLeadOffers(): string[] {
  return usePlatformOptions().data?.lists.leadOffers ?? OFFER_OPTIONS;
}
