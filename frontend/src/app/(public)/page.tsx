import Link from 'next/link';
import { ArrowRight, Building2, CalendarCheck, Compass, Handshake, PartyPopper, Quote, Rocket, UserPlus } from 'lucide-react';
import { Hero } from '@/components/features/Hero';
import { SpaceShowcase } from '@/components/features/SpaceShowcase';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { TestimonialReels } from '@/components/features/TestimonialReels';
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
  content: string | null;
  videoUrl: string | null;
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
    description: "Domiciliation, création d'entreprise, comptabilité, juridique — un catalogue entrepreneurial.",
  },
];

const PROCESS_STEPS = [
  {
    icon: UserPlus,
    title: 'Créer ton profil',
    description: 'Inscription en quelques minutes, profil visible dans l’annuaire des membres.',
  },
  {
    icon: Compass,
    title: 'Explorer le réseau',
    description: 'Parcours l’annuaire, repère les profils et compétences utiles à ton activité.',
  },
  {
    icon: CalendarCheck,
    title: 'Réserver un espace',
    description: 'Bureau, poste en open-space ou salle de réunion — à l’heure ou à la journée.',
  },
  {
    icon: PartyPopper,
    title: 'Participer aux événements',
    description: 'Conférences, ateliers et networking pour faire vivre le réseau au quotidien.',
  },
];

export const revalidate = 3600;

export default async function HomePage() {
  const [members, services, events, testimonials] = await Promise.all([
    serverGet<MemberProfileSummary[]>('/api/profiles?limit=6', 900, [], 'profiles'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
    serverGet<EventItem[]>('/api/events', 900, [], 'events'),
    serverGet<Testimonial[]>('/api/testimonials', 3600, [], 'testimonials'),
  ]);

  const featuredTestimonial = testimonials.find((t) => !t.videoUrl && t.content) ?? null;
  const otherTestimonials = testimonials.filter((t) => t.id !== featuredTestimonial?.id);

  return (
    <>
      <Hero />

      <section className="section-padding">
        <Container>
          <div className="grid gap-5 sm:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 90}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-orange/10 text-brand-orange">
                      <pillar.icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-ink-900">{pillar.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-500">{pillar.description}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-padding section-tint">
        <Container>
          <Reveal className="mb-12 max-w-xl">
            <span className="eyebrow mb-3">Comment ça marche</span>
            <h2 className="font-heading text-3xl font-bold text-ink-900 md:text-4xl">
              Du profil au <span className="text-brand-orange">réseau actif</span>, en quatre étapes
            </h2>
          </Reveal>

          <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-ink-900/10 lg:block"
            />
            {PROCESS_STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 90} className="relative flex flex-col gap-4">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-orange bg-brand-paper text-brand-orange">
                  <step.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-heading text-xs font-semibold tracking-[0.2em] text-ink-900/30">
                    ÉTAPE 0{i + 1}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-bold text-ink-900">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{step.description}</p>
                </div>
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
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {members.map((profile, i) => (
                <Reveal key={profile.id} delay={i * 60} className="w-[260px] shrink-0 snap-start">
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
            variant="sparse"
            className="pointer-events-none absolute -right-20 -top-20 h-[380px] w-[500px] opacity-40"
          />
          <Container className="section-padding relative">
            <Reveal>
              <span className="eyebrow-light mb-3">Ils en parlent</span>
            </Reveal>

            {(featuredTestimonial || events.length > 0) && (
              <Reveal className="mt-6 grid gap-8 rounded-card border border-white/10 bg-white/[0.04] p-8 backdrop-blur md:grid-cols-[auto,1fr] md:items-center md:gap-12 md:p-10">
                {events.length > 0 && (
                  <div className="flex shrink-0 flex-col items-start gap-1 md:border-r md:border-white/10 md:pr-12">
                    <span className="font-heading text-5xl font-bold text-brand-orange md:text-6xl">
                      {events.length}
                    </span>
                    <span className="max-w-[10rem] text-sm text-white/60">événements organisés au sein du réseau</span>
                  </div>
                )}
                {featuredTestimonial && (
                  <div>
                    <Quote className="h-6 w-6 text-brand-orange" strokeWidth={2} />
                    <blockquote className="mt-3 text-lg leading-relaxed text-white/90">
                      {featuredTestimonial.content}
                    </blockquote>
                    <p className="mt-4 text-sm font-semibold text-white">
                      {featuredTestimonial.authorName}
                      {featuredTestimonial.authorRole && (
                        <span className="font-normal text-white/60"> — {featuredTestimonial.authorRole}</span>
                      )}
                    </p>
                  </div>
                )}
              </Reveal>
            )}

            <Reveal className="mt-8">
              <TestimonialReels items={otherTestimonials} />
            </Reveal>
          </Container>
        </section>
      )}

      <section className="section-padding">
        <Container>
          <Reveal className="relative overflow-hidden rounded-3xl bg-brand-orange px-8 py-14 text-center sm:px-16">
            <NetworkMotif
              tone="white"
              variant="sparse"
              className="pointer-events-none absolute -right-16 -top-16 h-[320px] w-[420px] opacity-20"
            />
            <div className="relative flex flex-col items-center gap-5">
              <h2 className="max-w-2xl font-heading text-3xl font-bold text-white md:text-4xl">
                Prêt à rejoindre le réseau ?
              </h2>
              <p className="max-w-xl text-white/85">
                Crée ton profil, découvre l&apos;annuaire et réserve ton premier espace en quelques minutes.
              </p>
              <Link href="/register" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
                Devenir membre
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
