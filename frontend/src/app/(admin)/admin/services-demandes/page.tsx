'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ServiceRequestPanel,
  targetLabel,
  requesterLabel,
  type AdminServiceRequest,
} from '@/components/features/ServiceRequestPanel';
import { api } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

const TARGET_TYPE_LABEL: Record<AdminServiceRequest['targetType'], string> = {
  SERVICE: 'Service',
  SPACE: 'Espace',
  PLAN: 'Formule',
};

const STATUS_LABEL: Record<AdminServiceRequest['status'], string> = {
  NEW: 'Nouvelle',
  IN_PROGRESS: 'Prise en charge',
  DONE: 'Terminée',
  CANCELLED: 'Annulée',
};
const STATUS_VARIANT: Record<AdminServiceRequest['status'], 'neutral' | 'startup' | 'success'> = {
  NEW: 'startup',
  IN_PROGRESS: 'neutral',
  DONE: 'success',
  CANCELLED: 'neutral',
};

function formatQuote(req: AdminServiceRequest) {
  if (req.quotedAmount == null) return '—';
  return `${Number(req.quotedAmount).toLocaleString('fr-FR')} ${req.quotedCurrency}`;
}

// Liste complète des demandes de service (tous statuts). Cliquer sur une ligne
// ouvre le panneau d'édition : l'admin ajuste le devis et les détails, puis
// valide — c'est seulement à la validation que l'email de confirmation part.
export default function AdminServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminServiceRequest | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-service-requests', page],
    queryFn: () => api.get<ApiListResponse<AdminServiceRequest>>(`/api/admin/service-requests?page=${page}&limit=20`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Demandes de service</h1>
        <p className="mt-1 text-sm text-ink-500">{data?.meta.total ?? 0} demandes au total.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Aucune demande de service" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Demandeur</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Cible</th>
                    <th className="px-5 py-3">Devis</th>
                    <th className="px-5 py-3">Reçue le</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {data.data.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelected(req)}
                      className="cursor-pointer transition-colors hover:bg-ink-900/5"
                    >
                      <td className="px-5 py-3 font-medium text-ink-800">
                        {requesterLabel(req)}
                        {!req.user && (req.guestEmail || req.guestPhone || req.guestCompany) && (
                          <span className="block text-xs font-normal text-ink-400">
                            {[req.guestEmail, req.guestPhone, req.guestCompany].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-500">{TARGET_TYPE_LABEL[req.targetType]}</td>
                      <td className="px-5 py-3 text-ink-600">{targetLabel(req)}</td>
                      <td className="px-5 py-3 text-ink-600">{formatQuote(req)}</td>
                      <td className="px-5 py-3 text-ink-500">{new Date(req.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[req.status]}>{STATUS_LABEL[req.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-ink-500">
          <button disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            Précédent
          </button>
          <span>
            Page {data.meta.page} / {data.meta.totalPages}
          </span>
          <button disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}

      <ServiceRequestPanel
        key={selected?.id}
        request={selected}
        onClose={() => setSelected(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] })}
      />
    </div>
  );
}
