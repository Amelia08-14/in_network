'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface AdminBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  price: string;
  space: { name: string };
  user: { email: string; profile: { firstName: string; lastName: string } | null };
}

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'startup'> = {
  CONFIRMED: 'success',
  PENDING: 'neutral',
  CANCELLED: 'startup',
  COMPLETED: 'neutral',
};

// Gestion des demandes de location d'espaces (salles de réunion, bureaux) —
// confirmer/annuler une réservation depuis le dashboard.
export default function AdminReservationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get<ApiListResponse<AdminBooking>>('/api/admin/bookings?limit=50'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminBooking['status'] }) =>
      api.patch(`/api/admin/bookings/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">
          Réservations — demandes de location d&apos;espaces
        </h1>
        <p className="mt-1 text-sm text-gray-500">{data?.meta.total ?? 0} réservations au total.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Aucune réservation" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Membre</th>
                    <th className="px-5 py-3">Espace</th>
                    <th className="px-5 py-3">Créneau</th>
                    <th className="px-5 py-3">Prix</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((b) => (
                    <tr key={b.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {b.user.profile ? `${b.user.profile.firstName} ${b.user.profile.lastName}` : b.user.email}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{b.space.name}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{b.price} DZD</td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[b.status] ?? 'neutral'}>{b.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {b.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => statusMutation.mutate({ id: b.id, status: 'CONFIRMED' })}
                            >
                              Confirmer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => statusMutation.mutate({ id: b.id, status: 'CANCELLED' })}
                            >
                              Annuler
                            </Button>
                          </div>
                        )}
                        {b.status === 'CONFIRMED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'CANCELLED' })}
                          >
                            Annuler
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
