import type { Metadata } from 'next';

// Page client : ses métadonnées passent par ce layout (sinon titre de l'accueil).
export const metadata: Metadata = { title: 'Vérification de l’e-mail', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
