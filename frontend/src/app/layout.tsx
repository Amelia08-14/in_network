import type { Metadata } from 'next';
import { Montserrat, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Direction "Corporate futuriste" : Montserrat (titres — géométrique,
// moderne, demandée explicitement par la cliente) + Plus Jakarta Sans
// (corps de texte, lisibilité). Chargées via next/font/google (auto-
// hébergées, sans requête externe au runtime).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
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
  icons: {
    icon: '/in_icon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${plusJakarta.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
