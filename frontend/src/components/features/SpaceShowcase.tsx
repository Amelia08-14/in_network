import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/ui/reveal';
import { GalleryComingSoon } from '@/components/features/gallery/GalleryComingSoon';
import { SiteGalleryWall } from '@/components/features/gallery/SiteGalleryWall';
import { getPrimarySiteGallery } from '@/lib/site-gallery';

const FEATURES = [
  'Bureaux privés et postes en open-space',
  'Salles de réunion équipées, réservables à la demande',
  'Wifi fibre, café & thé inclus',
  'Un lieu pensé pour la rencontre, pas seulement pour le travail',
];

// Section volontairement différente du rythme "eyebrow + h2 + grille de 4
// cards" utilisé par les sections membres/services/événements — casse la
// répétition et ancre le site dans un lieu réel plutôt que dans l'abstrait.
// Les vraies photos ET vidéos du lieu (galerie admin) remplacent le
// placeholder dès qu'elles sont disponibles — jamais de contenu banque.
export async function SpaceShowcase() {
  const items = await getPrimarySiteGallery();

  return (
    <section className="section-padding">
      <Container>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="eyebrow justify-center">L&apos;espace</span>
          <h2 className="mt-3 font-heading text-3xl font-bold text-ink-900 md:text-4xl">
            Un lieu pensé pour la <span className="text-brand-orange">rencontre</span> autant que la
            productivité
          </h2>
          <p className="mt-3 text-ink-500">
            Avant d&apos;être une plateforme, IN NETWORK est d&apos;abord un espace physique à Hydra —
            conçu pour que le travail et les rencontres se croisent naturellement.
          </p>
        </div>

        <ul className="mx-auto mb-10 grid max-w-3xl gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
              {feature}
            </li>
          ))}
        </ul>

        <Reveal>{items.length > 0 ? <SiteGalleryWall items={items} /> : <GalleryComingSoon />}</Reveal>
      </Container>
    </section>
  );
}
