import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/section';
import { ScrollReveal } from '@/components/ui/scroll-motion';
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
// cards" — ancre le site dans un lieu réel. Les vraies photos ET vidéos du
// lieu (galerie admin) remplacent le placeholder dès qu'elles sont
// disponibles — jamais de contenu banque. Sur l'accueil on n'affiche qu'un
// aperçu (8 médias max), la galerie complète se consulte ailleurs.
export async function SpaceShowcase() {
  const allItems = await getPrimarySiteGallery();
  const items = allItems.slice(0, 8);

  return (
    <Section tone="tint">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="L'espace"
          title={
            <>
              Un lieu pensé pour la <span className="text-brand-orange">rencontre</span> autant que
              la productivité
            </>
          }
          lead="Avant d'être une plateforme, IN NETWORK est d'abord un espace physique à Hydra — conçu pour que le travail et les rencontres se croisent naturellement."
        />
        {allItems.length > items.length && (
          <Link
            href="/evenements/galerie"
            className="hidden items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline md:flex"
          >
            Voir toutes les images <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
            {feature}
          </li>
        ))}
      </ul>

      <ScrollReveal className="mt-12">
        {items.length > 0 ? <SiteGalleryWall items={items} /> : <GalleryComingSoon />}
      </ScrollReveal>
    </Section>
  );
}
