'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, X } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/api';

interface SpaceResource {
  id: string;
  name: string;
  type: string;
  hourlyRate: string | null;
}
interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
}
interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  space: { name: string };
}

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'startup'> = {
  CONFIRMED: 'success',
  PENDING: 'neutral',
  CANCELLED: 'startup',
  COMPLETED: 'neutral',
};

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => api.get<{ data: SpaceResource[] }>('/api/spaces').then((r) => r.data),
  });
  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/api/bookings').then((r) => r.data),
  });
  const { data: availability } = useQuery({
    queryKey: ['availability', spaceId, date],
    queryFn: () => api.get<{ data: { slots: Slot[] } }>(`/api/spaces/${spaceId}/availability?date=${date}`).then((r) => r.data),
    enabled: Boolean(spaceId && date),
  });

  const bookMutation = useMutation({
    mutationFn: (slot: Slot) => api.post('/api/bookings', { spaceId, startAt: slot.startAt, endAt: slot.endAt }),
    onSuccess: () => {
      setFeedback('Réservation créée avec succès.');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability', spaceId, date] });
    },
    onError: (e) => setFeedback(e instanceof ApiRequestError ? e.message : 'Erreur lors de la réservation'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/bookings/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Réservations</h1>
        <p className="mt-1 text-sm text-gray-500">Réserve un espace ou une salle de réunion.</p>
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Nouvelle réservation</CardTitle>
        </div>
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              <option value="">Choisir un espace...</option>
              {spaces?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.hourlyRate ? `(${s.hourlyRate} DZD/h)` : ''}
                </option>
              ))}
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {spaceId && availability && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {availability.slots.map((slot) => (
                <button
                  key={slot.startAt}
                  disabled={!slot.available || bookMutation.isPending}
                  onClick={() => bookMutation.mutate(slot)}
                  className="rounded-card border border-gray-200 py-2 text-xs font-medium text-gray-700 hover:border-brand-violet hover:text-brand-violet disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
                >
                  {new Date(slot.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}

          {feedback && <p className="text-sm text-brand-violet">{feedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <div className="p-5">
          <CardTitle>Mes réservations</CardTitle>
        </div>
        <CardContent className="pt-0">
          {!bookings || bookings.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Aucune réservation" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">{b.space.name}</p>
                    <p className="text-xs text-accent-gray">
                      {new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'neutral'}>{b.status}</Badge>
                    {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                      <button
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="text-accent-gray hover:text-brand-orange"
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
