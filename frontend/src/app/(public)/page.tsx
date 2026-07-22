import Link from 'next/link';
import { ArrowRight, Building2, Handshake, Quote, Rocket } from 'lucide-react';
import { Hero } from '@/components/features/Hero';
import { SpaceShowcase } from '@/components/features/SpaceShowcase';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';
import { MemberCard } from '@/components/features/MemberCard';
import { ServiceCard } from '@/components/features/ServiceCard';
import { EventCard } from '@/components/features/EventCard';
import { EmptyState } from '@/components/ui/empty-state';
import { NetworkMotif } from '@/components/ui/network-motif';
import { Reveal } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';
import { serverGet } from '@/lib/server-api';
import type { MemberProfileSummary, ServiceCatalogItem, EventItem } from '@/types';

interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string | null;
  content: string;
}

const PILLARS = [
  {
    icon: Building2,
    title: "Un lieu, pas qu'un espace",
    description: 'Bureaux, salles de réunion et postes de travail pensés pour la productivité et la rencontre.',
  },
  {
    icon: Handshake,
    title: 'Un réseau qui vous met en relation',
    description: 'Un annuaire ciblé et un moteur de suggestions basé sur vos compétences et besoins réels.',
  },
  {
    icon: Rocket,
    title: 'Des services pour avancer',
    description: 'Domiciliation, création d\'entreprise, comptabilité, juridique — un catalogue de services entrepreneuriaux.',
  },
];

export const revalidate = 3600;

export default async function HomePage() {
  const [members, services, events, testimonials] = await Promise.all([
    serverGet<MemberProfileSummary[]>('/api/profiles?limit=4', 900, []),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, []),
    serverGet<EventItem[]>('/api/events', 900, []),
    serverGet<Testimonial[]>('/api/testimonials', 3600, []),
  ]);

  return (
    <>
      <Hero />

      <section className="section-padding">
        <Container>
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 90} className="flex flex-col gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-orange/10 text-brand-orange">
                  <pillar.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-1 font-heading text-lg font-bold text-ink-900">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{pillar.description}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <SpaceShowcase />

      <section className="section-padding section-tint">
        <Container>
          <Reveal className="mb-10 flex items-end justify-between">
            <div>
              <span className="eyebrow mb-3">Le réseau</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
                Ils font partie du <span className="text-brand-orange">réseau</span>
              </h2>
              <p className="mt-2 text-ink-500">Un aperçu de l&apos;annuaire des membres IN NETWORK.</p>
            </div>
            <Link
              href="/annuaire"
              className="hidden items-center gap-1 text-sm font-semibold text-brand-blue hover:underline md:flex"
            >
              Voir tout l&apos;annuaire <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>

          {members.length === 0 ? (
            <EmptyState
              title="L'annuaire se construit"
              description="Les premiers membres apparaîtront ici dès leur inscription."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {members.map((profile, i) => (
                <Reveal key={profile.id} delay={i * 70}>
                  <MemberCard profile={profile} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="section-padding">
        <Container>
          <Reveal className="mb-10">
            <span className="eyebrow mb-3">Services</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
              Catalogue de services <span className="text-brand-orange">entrepreneuriaux</span>
            </h2>
            <p className="mt-2 text-ink-500">
              Domiciliation, création d&apos;entreprise, comptabilité et plus encore.
            </p>
          </Reveal>

          {services.length === 0 ? (
            <EmptyState title="Catalogue en préparation" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {services.slice(0, 4).map((service, i) => (
                <Reveal key={service.id} delay={i * 70}>
                  <ServiceCard service={service} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </section>

      {events.length > 0 && (
        <section className="section-padding section-tint">
          <Container>
            <Reveal className="mb-10">
              <span className="eyebrow mb-3">Agenda</span>
              <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
                Prochains <span className="text-brand-orange">événements</span>
              </h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.slice(0, 3).map((event, i) => (
                <Reveal key={event.id} delay={i * 80}>
                  <EventCard event={event} />
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="relative overflow-hidden bg-ink-900">
          <NetworkMotif
            tone="white"
            className="pointer-events-none absolute -right-20 -top-20 h-[380px] w-[500px] opacity-40"
          />
          <Container className="section-padding relative">
            <Reveal>
              <span className="eyebrow-light mb-3">Ils en parlent</span>
            </Reveal>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {testimonials.slice(0, 4).map((t, i) => (
                <Reveal key={t.id} delay={i * 90}>
                  <figure className="relative h-full rounded-card border border-white/10 bg-white/[0.04] p-7 backdrop-blur">
                    <Quote className="h-6 w-6 text-brand-orange" strokeWidth={2} />
                    <blockquote className="mt-3 text-lg leading-relaxed text-white/90">
                      {t.content}
                    </blockquote>
                    <figcaption className="mt-4 text-sm font-semibold text-white">
                      {t.authorName}
                      {t.authorRole && <span className="font-normal text-white/60"> — {t.authorRole}</span>}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="relative overflow-hidden border-t border-white/[0.06] bg-ink-900 text-white">
        <NetworkMotif
          tone="white"
          className="pointer-events-none absolute -left-24 -bottom-24 h-[420px] w-[560px] opacity-50"
        />
        <Container className="section-padding relative">
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <h2 className="max-w-2xl font-heading text-3xl font-bold text-white md:text-4xl">
              Prêt à rejoindre le <span className="text-brand-orange">réseau</span> ?
            </h2>
            <p className="max-w-xl text-white/70">
              Crée ton profil, découvre l&apos;annuaire et réserve ton premier espace en quelques minutes.
            </p>
            <Link href="/register" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              Devenir membre
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
