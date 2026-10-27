import type { Metadata } from 'next';

// Page client : ses métadonnées passent par ce layout (sinon titre de l'accueil).
export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
