'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface AdminPayment {
  id: string;
  amount: string;
  currency: string;
  method: 'CARD' | 'BANK_TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  relatedType: string;
  createdAt: string;
  user: { email: string; profile: { firstName: string; lastName: string } | null };
}

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'startup'> = {
  COMPLETED: 'success',
  PENDING: 'neutral',
  FAILED: 'startup',
  REFUNDED: 'neutral',
};

export default function AdminPaiementsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => api.get<ApiListResponse<AdminPayment>>('/api/admin/payments?limit=50'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/payments/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Paiements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Les virements bancaires (CDC §1.4) sont confirmés manuellement ici une fois reçus.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Aucun paiement" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Membre</th>
                    <th className="px-5 py-3">Montant</th>
                    <th className="px-5 py-3">Méthode</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {p.amount} {p.currency}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{p.method === 'CARD' ? 'Carte' : 'Virement'}</td>
                      <td className="px-5 py-3 text-gray-500">{p.relatedType}</td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>{p.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.method === 'BANK_TRANSFER' && p.status === 'PENDING' && (
                          <Button size="sm" variant="primary" onClick={() => confirmMutation.mutate(p.id)}>
                            Confirmer
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
