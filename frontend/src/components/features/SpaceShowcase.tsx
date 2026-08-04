import Image from 'next/image';
import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/ui/reveal';
import { GalleryComingSoon } from '@/components/features/gallery/GalleryComingSoon';
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
// Les vraies photos du lieu (galerie admin) remplacent tout placeholder dès
// qu'elles sont disponibles — jamais de photo banque en attendant.
export async function SpaceShowcase() {
  const images = await getPrimarySiteGallery();
  // Filtré aux images : la galerie du lieu contient aussi des vidéos
  // (visite en vidéo, logo animé) qui ne peuvent pas passer par next/image.
  const [main, second, third] = images.filter((img) => img.type === 'IMAGE');

  return (
    <section className="section-padding">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            {main ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-card shadow-soft-lg">
                  <Image
                    src={main.url}
                    alt={main.altText ?? "Espace de coworking IN NETWORK à Hydra"}
                    fill
                    sizes="(min-width: 1024px) 600px, 100vw"
                    className="object-cover"
                  />
                </div>
                {second && (
                  <div className="relative aspect-square overflow-hidden rounded-card shadow-soft">
                    <Image src={second.url} alt={second.altText ?? ''} fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />
                  </div>
                )}
                {third && (
                  <div className="relative aspect-square overflow-hidden rounded-card shadow-soft">
                    <Image src={third.url} alt={third.altText ?? ''} fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />
                  </div>
                )}
              </div>
            ) : (
              <GalleryComingSoon />
            )}
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
