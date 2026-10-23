'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, UserRound, CalendarDays, Users2, Building2, MessageCircle, ShoppingBag, PackageCheck, ReceiptText, History } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { ProfileCompletionBanner } from '@/components/features/ProfileCompletionBanner';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

const DOCUMENTS_HREF = '/dashboard/documents';
const CATALOGUE_HREF = '/dashboard/catalogue';

// Espace client (processus v1.3) : d'abord ses services et ce qui les entoure
// (demander, devis et factures, historique), puis la vie du lieu et du réseau.
const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { href: '/dashboard/services', label: 'Mes services', icon: PackageCheck },
  { href: CATALOGUE_HREF, label: 'Demander un service', icon: ShoppingBag },
  { href: DOCUMENTS_HREF, label: 'Devis et factures', icon: ReceiptText },
  { href: '/dashboard/historique', label: 'Historique', icon: History },
  { href: '/dashboard/reservations', label: 'Réservations', icon: CalendarDays },
  { href: '/dashboard/networking', label: 'Networking', icon: Users2 },
  // Messagerie : la suite d'une mise en relation acceptée (pastille = messages non lus).
  { href: '/dashboard/messages', label: 'Messages', icon: MessageCircle },
  { href: '/dashboard/profil', label: 'Mon profil', icon: UserRound },
];

// « Mon équipe » n'apparaît que pour le représentant qui a inscrit
// l'entreprise (company.isOwner) — les collaborateurs invités ne le voient pas.
const TEAM_NAV: NavItem = { href: '/dashboard/equipe', label: 'Mon équipe', icon: Building2 };

// Avant le premier paiement (décision du 23/10/2026), seuls ces onglets sont
// ouverts : la demande de devis et « Devis et factures » (devis, proforma,
// justificatif). Le reste est visible mais verrouillé ; tout s'ouvre
// automatiquement dès que l'équipe enregistre le paiement.
const OPEN_WHILE_PENDING = [CATALOGUE_HREF, DOCUMENTS_HREF];

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
  const onDocuments = pathname === DOCUMENTS_HREF || pathname.startsWith(`${DOCUMENTS_HREF}/`);

  // Garde d'accès : avant le paiement, seuls la demande de devis et « Devis et
  // factures » s'ouvrent (l'ancienne adresse /dashboard/situation y redirige).
  useEffect(() => {
    if (pending && pathname !== '/dashboard/situation' && !OPEN_WHILE_PENDING.some((href) => pathname === href || pathname.startsWith(`${href}/`))) {
      router.replace(DOCUMENTS_HREF);
    }
  }, [pending, pathname, router]);

  // Le paiement est enregistré par l'équipe pendant que le membre a l'onglet
  // ouvert : on relit son statut régulièrement (et au retour sur l'onglet) pour
  // que l'espace se déverrouille sans qu'il ait à se reconnecter.
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
    ? base.map((item) => ({ ...item, locked: !OPEN_WHILE_PENDING.includes(item.href), highlight: item.href === DOCUMENTS_HREF }))
    : base;

  return (
    <DashboardShell navItems={navItems} navNote={pending ? 'Votre espace s’ouvre entièrement dès votre premier paiement.' : undefined}>
      {validated && !onDocuments && <ProfileCompletionBanner />}
      {children}
    </DashboardShell>
  );
}
