'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import type { ApiListResponse } from '@/types';

interface AdminBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
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

export default function AdminReservationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get<ApiListResponse<AdminBooking>>('/api/admin/bookings?limit=50'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Réservations</h1>
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
