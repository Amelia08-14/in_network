import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Compass,
  Handshake,
  PartyPopper,
  Quote,
  Rocket,
  UserPlus,
} from 'lucide-react';
import { Hero } from '@/components/features/Hero';
import { SpaceShowcase } from '@/components/features/SpaceShowcase';
import { Section, SectionHeading } from '@/components/ui/section';
import { ScrollReveal } from '@/components/ui/scroll-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TestimonialReels } from '@/components/features/TestimonialReels';
import { buttonVariants } from '@/components/ui/button';
import { MemberCard } from '@/components/features/MemberCard';
import { ServiceCard } from '@/components/features/ServiceCard';
import { EventCard } from '@/components/features/EventCard';
import { EmptyState } from '@/components/ui/empty-state';
import { NetworkMotif } from '@/components/ui/network-motif';
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
    title: 'Coworking pensé pour avancer',
    description:
      'Bureaux privés, postes en open-space et salles de réunion équipées — un lieu conçu pour la productivité autant que la rencontre.',
  },
  {
    icon: Handshake,
    title: 'Un réseau qui vous met en relation',
    description:
      'Un annuaire ciblé et un moteur de suggestions fondé sur vos compétences et vos besoins réels, pas sur un carnet d’adresses figé.',
  },
  {
    icon: Rocket,
    title: 'Des services pour accélérer',
    description:
      "Domiciliation, création d'entreprise, comptabilité, juridique, marketing — un catalogue entrepreneurial au même endroit.",
  },
];

const PROCESS_STEPS = [
  { icon: UserPlus, title: 'Créer votre profil', description: 'Inscription en quelques minutes, profil visible dans l’annuaire des membres.' },
  { icon: Compass, title: 'Explorer le réseau', description: 'Parcourez l’annuaire, repérez les profils et compétences utiles à votre activité.' },
  { icon: CalendarCheck, title: 'Réserver un espace', description: 'Bureau, poste en open-space ou salle de réunion — à l’heure ou à la journée.' },
  { icon: PartyPopper, title: 'Rejoindre les événements', description: 'Conférences, ateliers et networking pour faire vivre le réseau au quotidien.' },
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

      {/* Bande navy structurelle — le manifeste, pas seulement le footer. */}
      <Section tone="navy" motifVariant="dense">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
          <SectionHeading
            tone="navy"
            eyebrow="Le parti pris"
            title={
              <>
                Un réseau structuré,
                <br />
                pas un annuaire de plus.
              </>
            }
            lead="IN NETWORK relie un lieu physique à Hydra, un annuaire qualifié et des services entrepreneuriaux — pour que les bonnes rencontres se transforment vraiment en opportunités."
          />
          <ScrollReveal stagger={110} className="grid gap-3 sm:grid-cols-3">
            {[
              ['Un lieu', 'Coworking & salles de réunion à Hydra, Alger'],
              ['Un réseau', 'Annuaire qualifié, mise en relation ciblée'],
              ['Des services', 'Domiciliation, juridique, compta, marketing'],
            ].map(([k, v]) => (
              <div key={k} className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="font-heading text-lg font-bold text-white">{k}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{v}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading
          eyebrow="Ce que vous y trouvez"
          title={
            <>
              Trois leviers, <span className="text-brand-orange">un seul endroit</span>
            </>
          }
        />
        <ScrollReveal stagger={90} className="mt-14 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="h-full">
              <CardContent className="flex h-full flex-col gap-4 p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                  <pillar.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-heading text-xl font-bold text-ink-900">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{pillar.description}</p>
              </CardContent>
            </Card>
          ))}
        </ScrollReveal>
      </Section>

      <Section tone="tint">
        <SectionHeading
          eyebrow="Comment ça marche"
          title={
            <>
              Du profil au <span className="text-brand-orange">réseau actif</span>, en quatre étapes
            </>
          }
        />
        <ScrollReveal className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 hidden h-px bg-ink-900/12 lg:block" />
          {PROCESS_STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col gap-4">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-orange bg-brand-paper-deep text-brand-orange">
                <step.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-heading text-xs font-bold tracking-[0.2em] text-ink-900/30">ÉTAPE 0{i + 1}</p>
                <h3 className="mt-1 font-heading text-lg font-bold text-ink-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{step.description}</p>
              </div>
            </div>
          ))}
        </ScrollReveal>
      </Section>

      <SpaceShowcase />

      <Section tone="navy">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            tone="navy"
            eyebrow="Le réseau"
            title={
              <>
                Ils font partie du <span className="text-brand-orange">réseau</span>
              </>
            }
            lead="Un aperçu de l'annuaire des membres IN NETWORK."
          />
          <Link
            href="/annuaire"
            className="hidden items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white md:flex"
          >
            Voir tout l&apos;annuaire <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {members.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center text-white/60">
            L&apos;annuaire se construit — les premiers membres apparaîtront ici dès leur inscription.
          </div>
        ) : (
          <div className="-mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {members.map((profile) => (
              <div key={profile.id} className="w-[270px] shrink-0 snap-start">
                <MemberCard profile={profile} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section tone="paper">
        <SectionHeading
          eyebrow="Services"
          title={
            <>
              Catalogue de services <span className="text-brand-orange">entrepreneuriaux</span>
            </>
          }
          lead="Domiciliation, création d'entreprise, comptabilité, juridique et plus encore."
        />
        {services.length === 0 ? (
          <EmptyState className="mt-12" title="Catalogue en préparation" />
        ) : (
          <ScrollReveal stagger={80} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.slice(0, 4).map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </ScrollReveal>
        )}
      </Section>

      {events.length > 0 && (
        <Section tone="tint">
          <SectionHeading
            eyebrow="Agenda"
            title={
              <>
                Prochains <span className="text-brand-orange">événements</span>
              </>
            }
          />
          <ScrollReveal stagger={90} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ScrollReveal>
        </Section>
      )}

      {testimonials.length > 0 && (
        <Section tone="navy" motifVariant="sparse">
          <SectionHeading tone="navy" eyebrow="Ils en parlent" title="La parole au réseau" />

          {(featuredTestimonial || events.length > 0) && (
            <div className="mt-10 grid gap-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm md:grid-cols-[auto_1fr] md:items-center md:gap-12 md:p-10">
              {events.length > 0 && (
                <div className="flex shrink-0 flex-col items-start gap-1 md:border-r md:border-white/10 md:pr-12">
                  <span className="font-heading text-5xl font-bold text-brand-orange md:text-6xl">{events.length}</span>
                  <span className="max-w-40 text-sm text-white/60">événements organisés au sein du réseau</span>
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
            </div>
          )}

          <div className="mt-8">
            <TestimonialReels items={otherTestimonials} />
          </div>
        </Section>
      )}

      <Section tone="paper">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-orange px-8 py-16 text-center sm:px-16">
          <NetworkMotif
            tone="white"
            variant="sparse"
            className="pointer-events-none absolute -right-16 -top-16 h-[320px] w-[420px] opacity-20"
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="max-w-2xl font-heading text-[clamp(1.8rem,3.5vw,2.75rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
              Prêt à rejoindre le réseau ?
            </h2>
            <p className="max-w-xl text-white/85">
              Créez votre profil, découvrez l&apos;annuaire et réservez votre premier espace en quelques minutes.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
                Devenir membre
              </Link>
              <Link
                href="/inscription-entreprise"
                className="inline-flex h-12 items-center justify-center rounded-card border border-white/40 px-7 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Inscrire mon entreprise
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
