import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Mail, MapPin, ShoppingBasket, Target, Users2 } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { BrandTexture } from '@/components/ui/brand-texture';
import { SERVICE_CATEGORY_ACCENT } from '@/components/ui/badge';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { CATEGORY_ICON, CATEGORY_LABEL, serviceSummary } from '@/components/features/ServiceCard';
import { serverGet } from '@/lib/server-api';
import { CURRENCY, formatDa, formatNumber } from '@/lib/money';
import { metaDescription } from '@/lib/seo';
import { HUE, SERVICE_HUE } from '@/lib/palette';
import { displayCategory, SERVICE_OPTION, sortServices } from '@/lib/services-order';
import { FAMILIES, SERVICE_CONTENT, typo, type Closing, type FamilyKey, type ServiceContent } from '@/lib/service-content';
import { cn } from '@/lib/utils';
import type { ServiceCatalogItem } from '@/types';

export const revalidate = 3600;

// Famille du catalogue d'un service, d'après sa catégorie (un service ajouté
// depuis l'admin hérite ainsi de l'appel à l'action de sa famille).
const CATEGORY_FAMILY: Record<string, FamilyKey> = {
  CREATION_ENTREPRISE: 'creation',
  ADMINISTRATION: 'administration',
  COMPTABILITE: 'finance',
  MARKETING: 'com',
};

// Titre propre à chaque service (« Service secrétariat — IN NETWORK ») : sans
// generateMetadata, les fiches reprenaient le titre de l'accueil.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await serverGet<ServiceCatalogItem | null>(`/api/services/${slug}`, 3600, null, 'services');
  if (!service) return { title: 'Service introuvable' };
  const content = SERVICE_CONTENT[slug];
  return {
    title: service.title,
    description: metaDescription(content ? `${content.tagline} ${content.intro[0] ?? ''}` : service.description),
  };
}

/** Description d'un service sans fiche éditoriale : une phrase d'introduction, puis des puces (« • … »). */
function splitDescription(description: string) {
  const lines = description.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    intro: lines.filter((line) => !line.startsWith('•')).join(' '),
    bullets: lines.filter((line) => line.startsWith('•')).map((line) => line.replace(/^•\s*/, '')),
  };
}

/** Dernière étape couverte par une formule de création (« Avancé — étapes 1 à 7 » → 7). */
const lastStep = (label: string) => Number(label.match(/à\s*(\d+)/)?.[1] ?? 0);

function SectionTitle({ children, lead }: { children: React.ReactNode; lead?: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-heading text-2xl font-bold text-ink-900 md:text-[1.75rem]">{children}</h2>
      <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-orange" />
      {lead && <p className="mt-3 max-w-2xl text-ink-500">{typo(lead)}</p>}
    </div>
  );
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [service, allServices] = await Promise.all([
    serverGet<ServiceCatalogItem | null>(`/api/services/${slug}`, 3600, null, 'services'),
    serverGet<ServiceCatalogItem[]>('/api/services', 3600, [], 'services'),
  ]);
  if (!service) notFound();

  const category = displayCategory(service.category);
  const hue = HUE[SERVICE_HUE[category] ?? 'gray'];
  const Icon = CATEGORY_ICON[category] ?? ArrowRight;
  const tiers = service.pricingTiers ?? [];
  const fallback = splitDescription(service.description);
  const content: ServiceContent = SERVICE_CONTENT[slug] ?? {
    tagline: fallback.intro,
    intro: [],
    prestations: fallback.bullets.map((title) => ({ title })),
  };
  const familyKey = content.family ?? CATEGORY_FAMILY[category];
  const family = familyKey ? FAMILIES[familyKey] : null;
  const closing: Closing | undefined = content.closing ?? family?.closing;
  const pricingNote = content.pricingNote ?? family?.pricingNote;
  const option = SERVICE_OPTION[slug];
  const siblings = sortServices(allServices.filter((s) => s.slug !== slug && displayCategory(s.category) === category && !['OFFRE', 'DIASPORA'].includes(s.category)));
  const otherOption = Object.entries(SERVICE_OPTION).find(([other]) => other !== slug && option);
  const otherOptionService = otherOption ? allServices.find((s) => s.slug === otherOption[0]) : undefined;
  // Couverture des étapes par formule (création déléguée) : « Essentiel — étapes 1 à 4 »…
  const coverage = tiers.map((tier) => ({ label: tier.label.split('—')[0].trim(), last: lastStep(tier.label) })).filter((c) => c.last > 0);
  const cartItem = { targetType: 'SERVICE' as const, targetId: service.id, title: service.title, price: null, category: service.category };

  return (
    <>
      {/* Accroche et introduction */}
      <section className="relative -mt-24 overflow-hidden md:-mt-28">
        <Container className="pb-12 pt-32 md:pt-36">
          <nav aria-label="Fil d’Ariane" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <Link href="/services" className="hover:text-ink-900">Services & tarifs</Link>
            <span aria-hidden>/</span>
            <Link href="/services#services" className="hover:text-ink-900">{family?.label ?? CATEGORY_LABEL[category] ?? 'Services'}</Link>
          </nav>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', hue.soft, hue.text)}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className={cn('text-xs font-semibold uppercase tracking-[0.16em]', hue.text)}>{family?.label ?? CATEGORY_LABEL[category]}</span>
                {option && (
                  <span className="rounded-pill bg-ink-900 px-3 py-1 text-xs font-semibold text-white">
                    Option {option.n} — {option.label}
                  </span>
                )}
              </div>
              <h1 className="mt-5 font-heading text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink-900">{service.title}</h1>
              {content.tagline && <p className="mt-4 font-heading text-xl font-semibold leading-snug text-brand-orange md:text-2xl">{typo(content.tagline)}</p>}
              <div className="mt-6 max-w-2xl space-y-4 text-lg leading-8 text-ink-600">
                {content.intro.map((paragraph) => (
                  <p key={paragraph}>{typo(paragraph)}</p>
                ))}
              </div>
            </div>

            {/* Repère tarifaire : le détail est plus bas (#tarifs). */}
            <Card accent={SERVICE_CATEGORY_ACCENT[category] ?? 'none'} className="lg:sticky lg:top-32">
              <CardContent className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Tarification</p>
                {tiers.length > 0 ? (
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-sm text-ink-500">{tiers.length > 1 ? 'À partir de' : ''}</span>
                    <span className="font-heading text-3xl font-bold tabular-nums text-ink-900">{formatNumber(Math.min(...tiers.map((t) => t.price)))}</span>
                    <span className={cn('text-sm font-semibold', hue.text)}>
                      {CURRENCY}
                      {category === 'SECRETARIAT' ? ' / mois' : ''}
                    </span>
                  </p>
                ) : (
                  <p className="font-heading text-2xl font-bold text-ink-900">Sur devis personnalisé</p>
                )}
                <p className="text-sm text-ink-500">Les montants sont indicatifs : l’équipe IN NETWORK vous transmet un devis personnalisé après étude de votre demande.</p>
                <div className="flex flex-col gap-2">
                  {tiers.length > 0 ? (
                    <a href="#tarifs" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
                      Voir les formules <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <AddToCartButton item={cartItem} variant="primary" size="lg" className="w-full" />
                  )}
                  <Link href={`/contact?sujet=${encodeURIComponent(service.title)}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}>
                    <Mail className="h-4 w-4" /> Nous contacter
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 pb-24">
        {/* Création d'entreprise : les deux options côte à côte (catalogue). */}
        {option && otherOptionService && (
          <section aria-label="Les deux options de création d’entreprise" className="grid gap-4 md:grid-cols-2">
            {[
              { s: service, o: option, current: true },
              { s: otherOptionService, o: SERVICE_OPTION[otherOptionService.slug], current: false },
            ]
              .sort((a, b) => a.o.n - b.o.n)
              .map(({ s, o, current }) => (
                <div key={s.slug} className={cn('rounded-3xl border p-6', current ? 'border-brand-orange/40 bg-brand-orange/[0.06]' : 'border-ink-900/10 bg-white/70')}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-orange">Option {o.n}</p>
                  <p className="mt-1 font-heading text-xl font-bold text-ink-900">{o.label}</p>
                  <p className="mt-1 text-sm text-ink-600">{s.title}</p>
                  <p className="mt-3 text-sm text-ink-500">
                    {(s.pricingTiers ?? []).map((t) => `${t.label} : ${formatDa(t.price)}`).join(' · ')}
                  </p>
                  {current ? (
                    <p className="mt-4 text-sm font-semibold text-brand-orange">Vous consultez cette option</p>
                  ) : (
                    <Link href={`/services/${s.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline-offset-4 hover:underline">
                      Découvrir l’option {o.n} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              ))}
          </section>
        )}

        {/* Secrétariat : une carte par formule (annexe A). */}
        {content.formulas && (
          <section id="tarifs" className="scroll-mt-32">
            <SectionTitle lead="Trois formules mensuelles, de l’essentiel à un service complet.">Choisissez votre formule</SectionTitle>
            <div className="grid items-stretch gap-6 lg:grid-cols-3">
              {content.formulas.map((formula) => {
                const tier = tiers.find((t) => t.label === formula.tier);
                const recommended = formula.tier === 'NET';
                return (
                  <Card key={formula.tier} accent={recommended ? 'orange' : 'ink'} className={cn('h-full', recommended && 'ring-2 ring-brand-orange/40')}>
                    <CardContent className="flex h-full flex-col gap-4">
                      <div>
                        <p className="font-heading text-2xl font-extrabold tracking-tight text-ink-900">{formula.tier}</p>
                        <p className="font-semibold text-brand-orange">{typo(formula.tagline)}</p>
                        {tier && (
                          <p className="mt-3 flex items-baseline gap-1.5">
                            <span className="font-heading text-3xl font-bold tabular-nums text-ink-900">{formatNumber(tier.price)}</span>
                            <span className="text-sm font-semibold text-ink-500">{CURRENCY} / mois</span>
                          </p>
                        )}
                      </div>
                      <p className="font-medium text-ink-800">{typo(formula.lead)}</p>
                      <p className="text-sm leading-relaxed text-ink-600">{typo(formula.text)}</p>
                      <ul className="space-y-2 border-t border-dashed border-ink-900/10 pt-4 text-sm text-ink-700">
                        {formula.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> {item}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm italic text-ink-500">{typo(formula.closing)}</p>
                      {tier && (
                        <AddToCartButton
                          item={{ ...cartItem, tierLabel: tier.label, price: tier.price }}
                          label={`Ajouter ${formula.tier} au devis`}
                          variant={recommended ? 'primary' : 'outline'}
                          size="lg"
                          className="mt-auto w-full"
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {content.comparison && (
              <div className="mt-10 overflow-x-auto rounded-card border border-ink-900/8 bg-white shadow-soft">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Comparatif des formules de secrétariat</caption>
                  <thead>
                    <tr className="bg-ink-900 text-white">
                      <th scope="col" className="p-4 font-semibold">Prestation</th>
                      {content.formulas.map((f) => (
                        <th key={f.tier} scope="col" className="p-4 text-center font-semibold">{f.tier}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {content.comparison.map((row) => (
                      <tr key={row.label} className="border-b border-ink-900/6">
                        <th scope="row" className="p-4 font-medium text-ink-800">{row.label}</th>
                        {content.formulas!.map((f) => (
                          <td key={f.tier} className="p-4 text-center">
                            {row.tiers.includes(f.tier) ? (
                              <Check className="mx-auto h-5 w-5 text-brand-orange" aria-label="Inclus" />
                            ) : (
                              <span className="text-ink-300" aria-label="Non inclus">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-ink-900/[0.03]">
                      <th scope="row" className="p-4 font-semibold text-ink-900">Prix / mois</th>
                      {content.formulas.map((f) => {
                        const tier = tiers.find((t) => t.label === f.tier);
                        return (
                          <td key={f.tier} className="whitespace-nowrap p-4 text-center font-heading font-bold tabular-nums text-ink-900">
                            {tier ? formatDa(tier.price) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Prestations : titre en gras + description. */}
        {content.prestations && content.prestations.length > 0 && (
          <section>
            <SectionTitle>{content.prestationsTitle ?? 'Nos prestations'}</SectionTitle>
            <ol className="grid gap-4 md:grid-cols-2">
              {content.prestations.map((p, i) => (
                <li key={p.title} className="flex gap-4 rounded-3xl border border-ink-900/8 bg-white/70 p-5 shadow-soft">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold', hue.soft, hue.text)}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="font-heading text-base font-bold text-ink-900">{typo(p.title)}</p>
                    {p.text && <p className="mt-1 text-sm leading-relaxed text-ink-600">{typo(p.text)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Frise numérotée (création d'entreprise, IN CUBATOR). */}
        {content.steps && (
          <section>
            <SectionTitle lead={content.steps.lead}>{content.steps.title}</SectionTitle>
            {coverage.length > 0 && (
              <ul className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Étapes couvertes par chaque formule">
                {coverage.map((c) => (
                  <li key={c.label} className="rounded-pill border border-brand-orange/25 bg-brand-orange/10 px-3 py-1 font-medium text-ink-800">
                    <span className="font-semibold text-brand-orange">{c.label}</span> : étapes 1 à {c.last}
                  </li>
                ))}
              </ul>
            )}
            <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.35rem] before:top-6 before:w-px before:bg-ink-900/12">
              {content.steps.items.map((step, i) => {
                const n = i + 1;
                const covering = coverage.filter((c) => n <= c.last).map((c) => c.label);
                return (
                  <li key={step.title} className="relative flex gap-4">
                    <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand-orange bg-brand-paper font-heading text-sm font-bold text-brand-orange">
                      {String(n).padStart(2, '0')}
                    </span>
                    <div className="flex-1 rounded-2xl border border-ink-900/8 bg-white/70 px-5 py-4">
                      <p className="font-heading text-base font-bold text-ink-900">{typo(step.title)}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{typo(step.text)}</p>
                      {coverage.length > 0 && (
                        <p className="mt-2 flex flex-wrap gap-1.5" aria-label="Formules qui incluent cette étape">
                          {coverage.map((c) => (
                            <span
                              key={c.label}
                              className={cn(
                                'rounded-pill px-2 py-0.5 text-[11px] font-semibold',
                                covering.includes(c.label) ? 'bg-ink-900 text-white' : 'bg-ink-900/[0.05] text-ink-400 line-through',
                              )}
                            >
                              {c.label}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Événementiel : les lieux (annexe E, §04). */}
        {content.venues && (
          <section>
            <SectionTitle>{content.venues.title}</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              {content.venues.items.map((venue) => (
                <div key={venue.name} className="rounded-3xl border border-ink-900/8 bg-white/70 p-5 shadow-soft">
                  <MapPin className="h-5 w-5 text-brand-orange" />
                  <p className="mt-3 font-heading text-base font-bold text-ink-900">{venue.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue">
                    <Users2 className="h-4 w-4" /> {venue.capacity}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{typo(venue.text)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.objective && (
          <section aria-label="L’objectif" className="flex gap-4 rounded-3xl border-l-4 border-brand-orange bg-white/70 p-6 shadow-soft md:p-8">
            <Target className="mt-1 h-6 w-6 shrink-0 text-brand-orange" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-orange">L’objectif</p>
              <p className="mt-2 font-heading text-xl font-semibold leading-snug text-ink-900">{typo(content.objective)}</p>
            </div>
          </section>
        )}

        {/* Appel à l'action (conclusion du catalogue). */}
        <section className="relative overflow-hidden rounded-[2rem] bg-ink-900 p-8 text-white md:p-12">
          <BrandTexture />
          <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">{typo(closing?.title ?? 'Parlons de votre projet.')}</h2>
              <div className="mt-4 space-y-3 text-white/75">
                {(closing?.paragraphs ?? ['L’équipe IN NETWORK étudie votre demande et vous transmet une proposition adaptée.']).map((paragraph) => (
                  <p key={paragraph}>{typo(paragraph)}</p>
                ))}
                {closing?.cta && <p className="font-semibold text-white">{typo(closing.cta)}</p>}
              </div>
              {closing?.signature && <p className="mt-6 font-heading text-lg font-semibold text-brand-orange">{typo(closing.signature)}</p>}
            </div>
            <div className="flex flex-col gap-3">
              {tiers.length > 0 ? (
                <a href="#tarifs" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
                  <ShoppingBasket className="h-4 w-4" /> Ajouter au devis
                </a>
              ) : (
                <AddToCartButton item={cartItem} variant="primary" size="lg" className="w-full" />
              )}
              <Link
                href={`/contact?sujet=${encodeURIComponent(service.title)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-white/40 px-7 text-base font-semibold text-white transition hover:bg-white/10"
              >
                <Mail className="h-4 w-4" /> Nous contacter
              </Link>
            </div>
          </div>
        </section>

        {/* Tarification (hors secrétariat, déjà détaillé par formule). */}
        {!content.formulas && (
          <section id="tarifs" className="scroll-mt-32">
            <SectionTitle>Tarification</SectionTitle>
            {tiers.length > 0 ? (
              <ul className="flex max-w-3xl flex-col gap-2">
                {tiers.map((tier) => (
                  <li key={tier.label} className={cn('flex items-center gap-4 rounded-xl border py-3 pl-4 pr-3', hue.soft, hue.border)}>
                    <span className="min-w-0 flex-1 text-ink-800">{tier.label}</span>
                    <span className="shrink-0 whitespace-nowrap font-heading text-xl font-bold tabular-nums text-ink-900">{formatDa(tier.price)}</span>
                    <AddToCartButton item={{ ...cartItem, tierLabel: tier.label, price: tier.price }} variant="primary" size="sm" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-dashed border-ink-900/15 bg-white/70 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-lg font-bold text-ink-900">Sur devis personnalisé</p>
                  {pricingNote && <p className="mt-1 text-sm text-ink-500">{typo(pricingNote)}</p>}
                </div>
                <AddToCartButton item={cartItem} variant="primary" size="md" className="shrink-0" />
              </div>
            )}
            <p className="mt-4 max-w-3xl text-sm text-ink-500">
              Les montants affichés sont indicatifs : un devis personnalisé vous est transmis par l’équipe IN NETWORK après étude de votre demande.
            </p>
          </section>
        )}

        {/* La famille du service et ses autres prestations. */}
        {siblings.length > 0 && (
          <section>
            <SectionTitle lead={family ? `${family.tagline}${family.intro[0] ? ` ${family.intro[0]}` : ''}` : undefined}>
              {family ? `Les autres services ${family.label === 'Création d’entreprise' ? 'de création d’entreprise' : family.label}` : 'Dans la même catégorie'}
            </SectionTitle>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group flex h-full flex-col gap-2 rounded-3xl border border-ink-900/8 bg-white/70 p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-ink-900/20"
                  >
                    <p className="font-heading text-base font-bold text-ink-900">{s.title}</p>
                    <p className="line-clamp-2 text-sm text-ink-500">{typo(SERVICE_CONTENT[s.slug]?.tagline ?? serviceSummary(s.description))}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-ink-900">
                      Voir le détail <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-6 text-sm">
          <Link href="/services#services" className="inline-flex items-center gap-1.5 font-semibold text-ink-900 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Tous les services
          </Link>
          <Link href="/devis" className="inline-flex items-center gap-1.5 font-semibold text-brand-blue hover:underline">
            <ShoppingBasket className="h-4 w-4" /> Voir ma demande de devis
          </Link>
        </div>
      </Container>
    </>
  );
}
