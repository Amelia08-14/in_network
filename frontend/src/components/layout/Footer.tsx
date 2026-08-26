import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Logo } from './Logo';
import { NetworkMotif } from '@/components/ui/network-motif';

const COLUMNS = [
  {
    title: 'Découvrir',
    links: [
      { href: '/annuaire', label: 'Annuaire des membres' },
      { href: '/experts', label: 'Experts & partenaires' },
      { href: '/services', label: 'Services entrepreneuriaux' },
      { href: '/evenements', label: 'Événements' },
    ],
  },
  {
    title: 'IN NETWORK',
    links: [
      { href: '/a-propos', label: 'À propos' },
      { href: '/tarifs', label: 'Tarifs & abonnements' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { href: '/mentions-legales', label: 'Mentions légales' },
      { href: '/cgu', label: "Conditions d'utilisation" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink-900 text-white/80">
      <NetworkMotif
        tone="white"
        className="pointer-events-none absolute -right-16 -top-16 h-[420px] w-[560px] opacity-60"
      />

      <Container className="relative grid gap-10 py-16 md:grid-cols-4">
        <div>
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            Le lieu et le réseau qui font avancer les entrepreneurs, freelances et PME — Hydra, Alger.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-orange" /> Hydra, Alger, Algérie
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
              <a href="tel:+213560067486" className="hover:text-white">+213 5 60 06 74 86</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
              <a href="mailto:Contact@in-network.dz" className="hover:text-white">Contact@in-network.dz</a>
            </li>
          </ul>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-white">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="relative border-t border-white/10 py-4">
        <Container className="text-center text-xs text-white/50">
          © {new Date().getFullYear()} IN NETWORK — La Maison IN Groupe. Tous droits réservés.
        </Container>
      </div>
    </footer>
  );
}
