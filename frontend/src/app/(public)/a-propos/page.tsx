import Image from 'next/image';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata = { title: 'À propos' };

// Photo temporaire (Unsplash, libre de droits) en attendant la bibliothèque
// média réelle (moment de networking au lieu Hydra).
const STORY_PHOTO =
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1400&q=80';

export default function AProposPage() {
  return (
    <Container className="section-padding max-w-3xl">
      <PageHeader
        eyebrow="À propos"
        title={
          <>
            La technologie suit le <span className="text-brand-orange">réseau</span>, elle ne le précède pas
          </>
        }
      />

      <div className="relative mb-10 aspect-[16/7] overflow-hidden rounded-card shadow-soft-lg">
        <Image
          src={STORY_PHOTO}
          alt="Rencontre entre membres du réseau IN NETWORK"
          fill
          sizes="(min-width: 1024px) 768px, 100vw"
          className="object-cover"
        />
      </div>

      <div className="space-y-4 text-ink-600">
        <p>
          IN NETWORK est né à Hydra, Alger, avec une conviction simple : les entrepreneurs, freelances et
          PME avancent plus vite lorsqu'ils sont bien entourés. Avant d'être une plateforme, IN NETWORK est
          d'abord un lieu — un espace de coworking pensé pour la rencontre autant que pour la
          productivité.
        </p>
        <p>
          Notre réseau réunit des profils complémentaires : freelances, startups, PME, membres de la
          diaspora, experts et partenaires. Le rôle d'IN NETWORK est de faciliter ces rencontres, à travers
          un annuaire ciblé et un moteur de mise en relation qui s'améliore avec le temps.
        </p>
        <p>
          IN NETWORK fait partie de La Maison IN Groupe, aux côtés d'IN ACADEMY, IN DEV et IN COM.
        </p>
      </div>
    </Container>
  );
}
