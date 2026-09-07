'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CreditCard, Users2, Sparkles, Building2 } from 'lucide-react';
import { StatWidget } from '@/components/features/StatWidget';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

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
  const company = useAuthStore((s) => s.user?.company);
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
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-gray-500">Bienvenue sur ton espace membre IN NETWORK.</p>
      </div>

      {company && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-900/10 bg-ink-900/[0.03] px-4 py-3 text-sm">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink-700 shadow-soft">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="text-ink-700">
            {company.isOwner ? (
              <>
                Vous gérez le compte entreprise <span className="font-semibold">{company.name}</span>.
              </>
            ) : (
              <>
                Membre de l&apos;équipe <span className="font-semibold">{company.name}</span>.
              </>
            )}
          </span>
          {company.isOwner && (
            <Link href="/dashboard/equipe" className="font-medium text-brand-blue hover:underline">
              Gérer mon équipe →
            </Link>
          )}
        </div>
      )}

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
