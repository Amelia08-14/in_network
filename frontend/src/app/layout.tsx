import type { Metadata } from 'next';
import { Roboto_Slab } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Charte graphique (Brand Guideline, p.14-15) : Roboto Slab pour les titres
// (typographie principale, auto-hébergée via next/font — aucune requête externe
// au runtime) ; le corps de texte suit la pile Helvetica définie dans
// globals.css (--font-body).
const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'IN NETWORK — Le réseau qui fait avancer les entrepreneurs',
    template: '%s — IN NETWORK',
  },
  description:
    "IN NETWORK : espace de coworking, mise en réseau et services entrepreneuriaux à Hydra, Alger.",
  icons: {
    icon: [{ url: '/in_icon.ico' }, { url: '/icon-symbol.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={robotoSlab.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
