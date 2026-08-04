'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CreditCard, Users2, Sparkles } from 'lucide-react';
import { StatWidget } from '@/components/features/StatWidget';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';

interface Subscription {
  id: string;
  status: string;
  plan: { name: string };
  endDate: string;
}
interface Booking {
  id: string;
  startAt: string;
  status: string;
  space: { name: string };
}
interface Suggestion {
  id: string;
  score: number;
}

export default function DashboardOverviewPage() {
  const { data: subscriptions } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get<{ data: Subscription[] }>('/api/subscriptions').then((r) => r.data),
  });
  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/api/bookings').then((r) => r.data),
  });
  const { data: suggestions } = useQuery({
    queryKey: ['my-suggestions'],
    queryFn: () => api.get<{ data: Suggestion[] }>('/api/connections/suggestions').then((r) => r.data),
  });

  const activeSubscription = subscriptions?.find((s) => s.status === 'ACTIVE');
  const upcomingBookings = bookings?.filter((b) => new Date(b.startAt) > new Date() && b.status !== 'CANCELLED') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Vue d'ensemble</h1>
        <p className="mt-1 text-sm text-gray-500">Bienvenue sur ton espace membre IN NETWORK.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          icon={CreditCard}
          label="Abonnement"
          value={activeSubscription ? activeSubscription.plan.name : 'Aucun'}
          hint={activeSubscription ? `Jusqu'au ${new Date(activeSubscription.endDate).toLocaleDateString('fr-FR')}` : 'Choisis une formule'}
        />
        <StatWidget icon={CalendarCheck} label="Réservations à venir" value={upcomingBookings.length} />
        <StatWidget icon={Sparkles} label="Matching networking" value={suggestions?.length ?? 0} hint="Profils professionnels suggérés" />
        <StatWidget icon={Users2} label="Rôle" value="Membre" />
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Prochaines réservations</CardTitle>
        </div>
        <CardContent className="pt-0">
          {upcomingBookings.length === 0 ? (
            <EmptyState title="Aucune réservation à venir" description="Réserve un espace depuis l'onglet Réservations." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingBookings.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-gray-700">{b.space.name}</span>
                  <span className="text-accent-gray">
                    {new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
