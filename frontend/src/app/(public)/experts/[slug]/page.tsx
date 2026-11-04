import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Building2, Check, Handshake, Languages, MapPin } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { buttonVariants } from '@/components/ui/button';
import { ExpertCard } from '@/components/features/ExpertCard';
import { ExpertConnectionRequest } from '@/components/features/ExpertConnectionRequest';
import { LinkedInLink } from '@/components/features/LinkedInLink';
import { serverGet } from '@/lib/server-api';
import { formatDa } from '@/lib/money';
import { metaDescription } from '@/lib/seo';
import { cn } from '@/lib/utils';
import type { ExpertSummary } from '@/types';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const expert = await serverGet<ExpertSummary | null>(`/api/experts/${slug}`, 3600, null, 'experts');
  if (!expert) return { title: 'Expert introuvable' };
  return { title: `${expert.displayName} — ${expert.expertiseArea}`, description: metaDescription(expert.bio) ?? `${expert.displayName}, ${expert.expertiseArea} : expert du réseau IN NETWORK.` };
}

// Profil d'un expert du réseau (demande cliente 04/11/2026) : présentation,
// domaines d'intervention, LinkedIn (grisé s'il n'est pas renseigné) et
// demande de mise en relation. Seules les informations saisies dans
// Admin › Experts sont affichées : aucune rubrique vide.
export default async function ExpertDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [expert, others] = await Promise.all([
    serverGet<ExpertSummary | null>(`/api/experts/${slug}`, 3600, null, 'experts'),
    serverGet<ExpertSummary[]>('/api/experts?limit=12', 3600, [], 'experts'),
  ]);
  if (!expert) notFound();
  const more = others.filter((e) => e.id !== expert.id).slice(0, 3);
  const facts = [
    expert.companyName ? { icon: Building2, text: expert.companyName } : null,
    expert.location ? { icon: MapPin, text: expert.location } : null,
    expert.languages ? { icon: Languages, text: expert.languages } : null,
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <>
      <section className="relative -mt-24 md:-mt-28">
        <Container className="pb-12 pt-32 md:pt-36">
          <Link href="/experts" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> Tous les experts
          </Link>
          <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr] md:items-center lg:gap-12">
            <AvatarPlaceholder name={expert.displayName} photoUrl={expert.photoUrl} size={240} className="mx-auto aspect-square w-full max-w-[240px] rounded-[2rem] shadow-soft-lg md:mx-0" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-500">Expert du réseau IN NETWORK</p>
                {expert.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-brand-orange/10 px-2.5 py-0.5 text-xs font-semibold text-brand-orange">
                    <BadgeCheck className="h-3.5 w-3.5" /> Vérifié
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-heading text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink-900">{expert.displayName}</h1>
              <p className="mt-3 font-heading text-xl font-semibold leading-snug text-brand-orange">{expert.expertiseArea}</p>
              {facts.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
                  {facts.map((fact) => (
                    <li key={fact.text} className="inline-flex items-center gap-2">
                      <fact.icon className="h-4 w-4 text-ink-400" /> {fact.text}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#mise-en-relation" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}>
                  <Handshake className="h-4 w-4" /> Demander une mise en relation
                </a>
                <LinkedInLink url={expert.linkedinUrl} name={expert.displayName} />
              </div>
              {!expert.linkedinUrl && <p className="mt-2 text-xs text-ink-400">Profil LinkedIn non renseigné pour le moment.</p>}
            </div>
          </div>
        </Container>
      </section>

      <Container className="pb-24">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="space-y-8">
            {expert.bio && (
              <section className="rounded-[1.75rem] border border-ink-900/8 bg-white/70 p-6 shadow-soft md:p-8">
                <h2 className="font-heading text-xl font-bold text-ink-900">À propos</h2>
                <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-orange" />
                <p className="mt-5 whitespace-pre-line leading-relaxed text-ink-600">{expert.bio}</p>
              </section>
            )}

            {expert.servicesOffered?.length > 0 && (
              <section className="rounded-[1.75rem] border border-ink-900/8 bg-white/70 p-6 shadow-soft md:p-8">
                <h2 className="font-heading text-xl font-bold text-ink-900">Domaines d’intervention</h2>
                <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-orange" />
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {expert.servicesOffered.map((service) => (
                    <li key={service} className="flex items-start gap-2 text-sm text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> {service}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside id="mise-en-relation" className="scroll-mt-32 space-y-4 lg:sticky lg:top-32">
            <div className="rounded-[1.75rem] bg-ink-900 p-6 text-white shadow-soft-lg md:p-7">
              <p className="font-heading text-lg font-bold">Échanger avec {expert.displayName.split(' ')[0]}</p>
              <p className="mt-1 text-sm text-white/70">Présentez votre besoin : l’équipe IN NETWORK organise la mise en relation.</p>
              {expert.hourlyRate && (
                <p className="mt-4 text-sm text-white/80">
                  Tarif indicatif : <span className="font-heading text-lg font-bold text-white">{formatDa(expert.hourlyRate)}</span> / heure
                </p>
              )}
            </div>
            <ExpertConnectionRequest expertId={expert.id} expertName={expert.displayName} />
          </aside>
        </div>

        {more.length > 0 && (
          <section className="mt-16">
            <h2 className="font-heading text-2xl font-bold text-ink-900">D’autres experts du réseau</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((other) => (
                <ExpertCard key={other.id} expert={other} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
