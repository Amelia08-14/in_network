import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Direction "Corporate épuré & moderne" : Manrope (titres, géométrique et
// premium) + Inter (corps de texte, lisibilité maximale). Chargées via
// next/font/google (auto-hébergées, sans requête externe au runtime).
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'IN NETWORK — Le réseau qui fait avancer les entrepreneurs',
    template: '%s — IN NETWORK',
  },
  description:
    "IN NETWORK : espace de coworking, mise en réseau et services entrepreneuriaux à Hydra, Alger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
