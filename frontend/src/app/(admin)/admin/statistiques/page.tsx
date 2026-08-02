'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/admin-api';

// Palette recharts alignée sur la charte (navy + orange, cf. tailwind.config.ts) —
// pas de couleurs recharts par défaut, jamais de violet.
const NAVY = '#0F1B2E';
const ORANGE = '#D44835';
const BLUE = '#1D4ED8';
const GREEN = '#73B866';

interface MonthPoint {
  month: string;
  value: number;
}
interface LabelCount {
  label: string;
  count: number;
}
interface AdminStats {
  totalRevenue: string;
  revenueByMonth: MonthPoint[];
  newMembersByMonth: MonthPoint[];
  bookingsBySpace: LabelCount[];
  topEvents: { title: string; registrations: number }[];
}

function monthLabel(month: string) {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
}

export default function AdminStatistiquesPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/api/admin/stats').then((r) => r.data),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Chargement...</p>;
  if (!stats) return <EmptyState title="Statistiques indisponibles" />;

  const revenue = stats.revenueByMonth.map((p) => ({ ...p, label: monthLabel(p.month) }));
  const members = stats.newMembersByMonth.map((p) => ({ ...p, label: monthLabel(p.month) }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Statistiques</h1>
        <p className="mt-1 text-sm text-gray-500">Revenu total : {Number(stats.totalRevenue).toLocaleString('fr-FR')} DZD</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
              Revenu encaissé (12 derniers mois)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} DZD`} />
                  <Line type="monotone" dataKey="value" stroke={ORANGE} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
              Nouveaux membres (12 derniers mois)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={members}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
              Réservations par espace
            </h2>
            {stats.bookingsBySpace.length === 0 ? (
              <EmptyState title="Pas encore de réservations" className="py-8" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.bookingsBySpace} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
              Événements les plus suivis
            </h2>
            {stats.topEvents.length === 0 ? (
              <EmptyState title="Pas encore d'inscriptions" className="py-8" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topEvents} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="title" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip />
                    <Bar dataKey="registrations" fill={GREEN} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
