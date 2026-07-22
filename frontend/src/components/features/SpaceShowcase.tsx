import Image from 'next/image';
import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/ui/reveal';

const FEATURES = [
  'Bureaux privés et postes en open-space',
  'Salles de réunion équipées, réservables à la demande',
  'Wifi fibre, café & thé inclus',
  'Un lieu pensé pour la rencontre, pas seulement pour le travail',
];

// Photos temporaires (Unsplash, libres de droits) en attendant la bibliothèque
// média réelle du lieu Hydra — à remplacer dès qu'elle est disponible.
const PLACEHOLDER_PHOTOS = {
  main: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
  meeting: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
  desk: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
};

// Section volontairement différente du rythme "eyebrow + h2 + grille de 4
// cards" utilisé par les sections membres/services/événements — casse la
// répétition et ancre le site dans un lieu réel plutôt que dans l'abstrait.
export function SpaceShowcase() {
  return (
    <section className="section-padding">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="grid grid-cols-2 gap-4">
            <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-card shadow-soft-lg">
              <Image
                src={PLACEHOLDER_PHOTOS.main}
                alt="Espace de coworking IN NETWORK à Hydra"
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-card shadow-soft">
              <Image
                src={PLACEHOLDER_PHOTOS.meeting}
                alt="Salle de réunion IN NETWORK"
                fill
                sizes="(min-width: 1024px) 300px, 50vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-card shadow-soft">
              <Image
                src={PLACEHOLDER_PHOTOS.desk}
                alt="Poste de travail IN NETWORK"
                fill
                sizes="(min-width: 1024px) 300px, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <Reveal delay={120} className="flex flex-col gap-5">
            <span className="eyebrow">L&apos;espace</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
              Un lieu pensé pour la <span className="text-brand-orange">rencontre</span> autant que la
              productivité
            </h2>
            <p className="text-ink-500">
              Avant d&apos;être une plateforme, IN NETWORK est d&apos;abord un espace physique à
              Hydra — conçu pour que le travail et les rencontres se croisent naturellement.
            </p>
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                  {feature}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
