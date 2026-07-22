'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, CalendarCheck, TrendingUp } from 'lucide-react';
import { StatWidget } from '@/components/features/StatWidget';
import { api } from '@/lib/api';

interface AdminStats {
  totalMembers: number;
  newMembersLast30Days: number;
  activeSubscriptions: number;
  upcomingBookings: number;
  totalRevenue: string;
}

export default function AdminOverviewPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/api/admin/stats').then((r) => r.data),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Backoffice — Vue d'ensemble</h1>
        <p className="mt-1 text-sm text-gray-500">IN NETWORK Hydra, Alger.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          icon={Users}
          label="Membres"
          value={stats?.totalMembers ?? '—'}
          hint={stats ? `+${stats.newMembersLast30Days} sur 30 jours` : undefined}
        />
        <StatWidget icon={CreditCard} label="Abonnements actifs" value={stats?.activeSubscriptions ?? '—'} />
        <StatWidget icon={CalendarCheck} label="Réservations à venir" value={stats?.upcomingBookings ?? '—'} />
        <StatWidget icon={TrendingUp} label="Revenu total" value={stats ? `${stats.totalRevenue} DZD` : '—'} />
      </div>
    </div>
  );
}
