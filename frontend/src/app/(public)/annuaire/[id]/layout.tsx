import type { Metadata } from 'next';

// Fiche membre (page client, réservée aux membres connectés) : titre propre,
// jamais celui de l'accueil, et pas d'indexation.
export const metadata: Metadata = {
  title: 'Fiche membre',
  robots: { index: false, follow: false },
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return children;
}
