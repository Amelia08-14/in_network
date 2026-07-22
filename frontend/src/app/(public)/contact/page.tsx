import { Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <Container className="section-padding">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <span className="eyebrow">Contact</span>
          <h1 className="mt-3 font-heading text-3xl font-bold text-ink-900">
            Parlons de votre <span className="text-brand-orange">projet</span>
          </h1>
          <p className="mt-3 max-w-md text-ink-500">
            Une question sur nos formules, nos services ou le réseau ? Écris-nous.
          </p>

          <div className="mt-8 space-y-4 text-sm text-ink-700">
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

        <form className="space-y-4">
          <div>
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" rows={5} required />
          </div>
          <Button type="submit" variant="primary" className="w-full">
            Envoyer le message
          </Button>
        </form>
      </div>
    </Container>
  );
}
