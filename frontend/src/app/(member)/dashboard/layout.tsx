'use client';

import { useEffect } from 'react';
import { LayoutDashboard, UserRound, CalendarDays, Users2, Building2 } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { ProfileCompletionBanner } from '@/components/features/ProfileCompletionBanner';
import { useAuthStore } from '@/store/auth';

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/dashboard/profil', label: 'Mon profil', icon: UserRound },
  { href: '/dashboard/reservations', label: 'Réservations', icon: CalendarDays },
  { href: '/dashboard/networking', label: 'Networking', icon: Users2 },
];

// « Mon équipe » n'apparaît que pour le représentant qui a inscrit
// l'entreprise (company.isOwner) — les collaborateurs invités ne le voient pas.
const TEAM_NAV: NavItem = { href: '/dashboard/equipe', label: 'Mon équipe', icon: Building2 };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, status, hydrate } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  const navItems = user?.company?.isOwner ? [...BASE_NAV, TEAM_NAV] : BASE_NAV;

  return (
    <DashboardShell navItems={navItems}>
      <ProfileCompletionBanner />
      {children}
    </DashboardShell>
  );
}
