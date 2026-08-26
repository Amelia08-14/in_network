import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactForm } from '@/components/features/ContactForm';

export const metadata = { title: 'Contact' };

// Coordonnées réelles — brief client §2.1. Coordonnées GPS de l'iframe
// résolues depuis le lien Maps fourni (36.73847, 3.029172, Hydra, Alger) ;
// le libellé d'adresse en toutes lettres (numéro de rue) n'a pas pu être
// extrait automatiquement depuis cet environnement et reste à confirmer.
const MAPS_EMBED_SRC = 'https://www.google.com/maps?q=36.73847,3.029172&hl=fr&z=17&output=embed';

export default function ContactPage() {
  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Contact"
        title={<>Parlons de votre <span className="text-brand-orange">projet</span></>}
        description="Une question sur nos formules, nos services ou le réseau ? Écris-nous."
      />
      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-8">
          <div className="space-y-4 text-sm text-ink-700">
            <p className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-brand-orange" />
              Hydra, Alger, Algérie
            </p>
            <p className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-brand-orange" />
              <a href="mailto:Contact@in-network.dz" className="hover:text-brand-orange">Contact@in-network.dz</a>
            </p>
            <p className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-brand-orange" />
              <a href="tel:+213560067486" className="hover:text-brand-orange">+213 5 60 06 74 86</a>
            </p>
            <p className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
              <span>
                09h00 – 17h00 (heures administratives)
                <br />
                <span className="text-ink-500">Accès 24h/24, 7j/7 pour les membres coworking</span>
              </span>
            </p>
          </div>

          <div className="overflow-hidden rounded-card border border-ink-900/[0.08] shadow-soft">
            <iframe
              title="Localisation IN NETWORK — Hydra, Alger"
              src={MAPS_EMBED_SRC}
              className="h-64 w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <ContactForm />
      </div>
    </Container>
  );
}
