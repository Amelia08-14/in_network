'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, UserRound, CalendarDays, Users2, Building2, ClipboardCheck, MessageCircle, ShoppingBag } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { ProfileCompletionBanner } from '@/components/features/ProfileCompletionBanner';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

const SITUATION_HREF = '/dashboard/situation';

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: '/dashboard/profil', label: 'Mon profil', icon: UserRound },
  { href: '/dashboard/services', label: 'Services', icon: ShoppingBag },
  { href: '/dashboard/reservations', label: 'Réservations', icon: CalendarDays },
  { href: '/dashboard/networking', label: 'Networking', icon: Users2 },
  // Messagerie : la suite d'une mise en relation acceptée (pastille = messages non lus).
  { href: '/dashboard/messages', label: 'Messages', icon: MessageCircle },
];

// « Mon équipe » n'apparaît que pour le représentant qui a inscrit
// l'entreprise (company.isOwner) — les collaborateurs invités ne le voient pas.
const TEAM_NAV: NavItem = { href: '/dashboard/equipe', label: 'Mon équipe', icon: Building2 };

// Onglet affiché uniquement tant que le compte n'est pas validé : il disparaît
// dès que l'équipe valide (l'espace complet est alors déverrouillé).
const SITUATION_NAV: NavItem = {
  href: SITUATION_HREF,
  label: 'Situation du compte',
  icon: ClipboardCheck,
  highlight: true,
};

// Tant que le compte est en attente, seuls ces onglets restent actifs :
// « Situation » (suivi + envoi du reçu) et « Mon profil » (le profil complet
// fait partie des éléments examinés pour valider le compte).
const OPEN_WHILE_PENDING = [SITUATION_HREF, '/dashboard/profil'];

const PENDING_POLL_MS = 30_000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, status, hydrate, refreshUser } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  const pending = status === 'authenticated' && user?.role === 'MEMBER' && user.validated === false;
  const validated = status === 'authenticated' && !pending;
  const onSituation = pathname === SITUATION_HREF || pathname.startsWith(`${SITUATION_HREF}/`);

  // Garde d'accès : un compte en attente ne peut ouvrir que Situation / Profil ;
  // un compte validé n'a plus rien à faire sur « Situation ».
  useEffect(() => {
    if (pending && !OPEN_WHILE_PENDING.some((href) => pathname === href || pathname.startsWith(`${href}/`))) {
      router.replace(SITUATION_HREF);
    }
    if (validated && onSituation) router.replace('/dashboard');
  }, [pending, validated, onSituation, pathname, router]);

  // La validation se fait côté équipe, pendant que le membre a l'onglet ouvert :
  // on relit son statut régulièrement (et au retour sur l'onglet) pour que
  // l'espace se déverrouille sans qu'il ait à se reconnecter.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void refreshUser(), PENDING_POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refreshUser();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pending, refreshUser]);

  // Messages non lus (actualisés toutes les 20 s, seulement pour un compte validé).
  const { data: unread } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: () => api.get<{ data: { count: number } }>('/api/messages/unread-count').then((r) => r.data.count),
    enabled: validated,
    refetchInterval: 20_000,
  });

  const withBadges = BASE_NAV.map((item) => (item.href === '/dashboard/messages' && unread ? { ...item, badge: unread } : item));
  const base = user?.company?.isOwner ? [...withBadges, TEAM_NAV] : withBadges;
  const navItems: NavItem[] = pending
    ? [SITUATION_NAV, ...base.map((item) => ({ ...item, locked: !OPEN_WHILE_PENDING.includes(item.href) }))]
    : base;

  return (
    <DashboardShell
      navItems={navItems}
      navNote={pending ? 'Vos onglets seront débloqués dès que l’équipe IN NETWORK aura validé votre compte.' : undefined}
    >
      {!onSituation && <ProfileCompletionBanner />}
      {children}
    </DashboardShell>
  );
}
