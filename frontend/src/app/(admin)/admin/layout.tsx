'use client';

import { LayoutDashboard, Users, CalendarCheck, CreditCard } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/admin/membres', label: 'Membres', icon: Users },
  { href: '/admin/reservations', label: 'Réservations', icon: CalendarCheck },
  { href: '/admin/paiements', label: 'Paiements', icon: CreditCard },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navItems={NAV_ITEMS} requireRole={['ADMIN', 'SUPER_ADMIN']}>
      {children}
    </DashboardShell>
  );
}
