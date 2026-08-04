'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface AdminServiceRequest {
  id: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  targetType: 'SERVICE' | 'SPACE' | 'PLAN';
  service: { title: string } | null;
  space: { name: string } | null;
  plan: { name: string } | null;
  user: { email: string; profile: { firstName: string; lastName: string } | null } | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCompany: string | null;
}

const TARGET_TYPE_LABEL: Record<AdminServiceRequest['targetType'], string> = {
  SERVICE: 'Service',
  SPACE: 'Espace',
  PLAN: 'Formule',
};

function targetLabel(req: AdminServiceRequest) {
  return req.service?.title ?? req.space?.name ?? req.plan?.name ?? '—';
}

function requesterLabel(req: AdminServiceRequest) {
  if (req.user) return req.user.profile ? `${req.user.profile.firstName} ${req.user.profile.lastName}` : req.user.email;
  return req.guestName ?? 'Visiteur';
}

const STATUS_LABEL: Record<AdminServiceRequest['status'], string> = {
  NEW: 'Nouvelle',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminée',
  CANCELLED: 'Annulée',
};
const STATUS_VARIANT: Record<AdminServiceRequest['status'], 'neutral' | 'startup' | 'success'> = {
  NEW: 'startup',
  IN_PROGRESS: 'neutral',
  DONE: 'success',
  CANCELLED: 'neutral',
};

// Liste complète des demandes de service (tous statuts) — Validations
// n'affiche que les demandes NEW en attente ; ici on suit tout le cycle.
export default function AdminServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-service-requests', page],
    queryFn: () => api.get<ApiListResponse<AdminServiceRequest>>(`/api/admin/service-requests?page=${page}&limit=20`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminServiceRequest['status'] }) =>
      api.patch(`/api/admin/service-requests/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Demandes de service</h1>
        <p className="mt-1 text-sm text-gray-500">{data?.meta.total ?? 0} demandes au total.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Aucune demande de service" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Demandeur</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Cible</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Reçue le</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((req) => (
                    <tr key={req.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {requesterLabel(req)}
                        {!req.user && (req.guestEmail || req.guestPhone || req.guestCompany) && (
                          <span className="block text-xs font-normal text-gray-400">
                            {[req.guestEmail, req.guestPhone, req.guestCompany].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{TARGET_TYPE_LABEL[req.targetType]}</td>
                      <td className="px-5 py-3 text-gray-600">{targetLabel(req)}</td>
                      <td className="px-5 py-3 max-w-xs truncate text-gray-500">{req.notes ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{new Date(req.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[req.status]}>{STATUS_LABEL[req.status]}</Badge>
                          <Select
                            className="h-8 w-36 text-xs"
                            value={req.status}
                            onChange={(e) =>
                              statusMutation.mutate({
                                id: req.id,
                                status: e.target.value as AdminServiceRequest['status'],
                              })
                            }
                          >
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </div>
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
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
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
    </div>
  );
}
