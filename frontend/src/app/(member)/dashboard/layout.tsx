'use client';

import { LayoutDashboard, UserRound, CalendarDays, Users2 } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/dashboard/profil', label: 'Mon profil', icon: UserRound },
  { href: '/dashboard/reservations', label: 'Réservations', icon: CalendarDays },
  { href: '/dashboard/connexions', label: 'Networking', icon: Users2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell navItems={NAV_ITEMS}>{children}</DashboardShell>;
}
