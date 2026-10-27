import type { Metadata } from 'next';

// L'annuaire est une page client (filtres, session) : ses métadonnées passent
// par ce layout. Réservé aux membres connectés, il n'a pas à être indexé.
export const metadata: Metadata = {
  title: 'Annuaire des membres',
  description: 'L’annuaire des membres IN NETWORK : entrepreneurs, freelances, startups et entreprises du réseau, réservé aux membres connectés.',
  robots: { index: false, follow: true },
};

export default function AnnuaireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
