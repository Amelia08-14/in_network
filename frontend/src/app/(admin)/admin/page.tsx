'use client';

import { DirectionDashboard } from '@/components/admin/DirectionDashboard';
import { MyDay } from '@/components/admin/MyDay';
import { useAdminAuthStore } from '@/store/admin-auth';

// Page d'accueil du back-office (retours du 22/11/2026) : la Direction
// (administrateurs) arrive sur le tableau de bord chiffré de l'entreprise ;
// les autres profils sur « Ma journée », leurs files d'attente.
export default function AdminHomePage() {
  const role = useAdminAuthStore((s) => s.user?.role);
  return role === 'ADMIN' || role === 'SUPER_ADMIN' ? <DirectionDashboard /> : <MyDay />;
}
