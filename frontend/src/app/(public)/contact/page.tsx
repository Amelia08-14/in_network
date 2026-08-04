import { Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactForm } from '@/components/features/ContactForm';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Contact"
        title={<>Parlons de votre <span className="text-brand-orange">projet</span></>}
        description="Une question sur nos formules, nos services ou le réseau ? Écris-nous."
      />
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="space-y-4 text-sm text-ink-700">
            <p className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-brand-orange" />
              Hydra, Alger, Algérie <span className="text-xs text-ink-500">(adresse précise à confirmer)</span>
            </p>
            <p className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-brand-orange" /> contact@innetwork.dz
            </p>
            <p className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-brand-orange" /> +213 (0)XX XX XX XX
            </p>
          </div>
        </div>

        <ContactForm />
      </div>
    </Container>
  );
}
