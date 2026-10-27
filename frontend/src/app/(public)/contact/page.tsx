import Image from 'next/image';
import { ArrowRight, Clock, Coffee, Mail, MapPin, Navigation, Phone, ShieldCheck, Wifi } from 'lucide-react';
import { ContactForm } from '@/components/features/ContactForm';
import { VENUE_PHOTOS } from '@/lib/venue-photos';
import { BrandTexture } from '@/components/ui/brand-texture';
import { ADDRESS_LINE, ADDRESS_REGION, EMAIL, MAPS_DIRECTIONS, MAPS_EMBED_SRC, PHONE } from '@/lib/site-info';

export const metadata = {
  title: 'Contact',
  description: 'Une question, une visite, un devis ? Contactez IN NETWORK à Hydra, Alger : téléphone, e-mail, itinéraire et formulaire.',
};

// Coordonnées réelles (lib/site-info.ts) : adresse exacte confirmée le 27/10/2026.

const CONTACTS = [
  { icon: MapPin, title: 'Notre adresse', lines: [ADDRESS_LINE, ADDRESS_REGION], action: { label: 'Voir l’itinéraire', href: MAPS_DIRECTIONS, external: true } },
  { icon: Phone, title: 'Téléphone', lines: [PHONE.display], action: { label: 'Nous appeler', href: PHONE.href } },
  { icon: Mail, title: 'E-mail', lines: [EMAIL], action: { label: 'Nous écrire', href: `mailto:${EMAIL}` } },
  { icon: Clock, title: 'Horaires', lines: ['09h00 – 17h00 (heures administratives)', 'Accès 24h/24, 7j/7 pour les membres'] },
];

const VENUE_POINTS = [
  { icon: Navigation, title: 'Accès facile', text: 'Depuis Hydra et Saïd Hamdine' },
  { icon: Wifi, title: 'Connexion haut débit', text: 'Dans tous les espaces' },
  { icon: Coffee, title: 'Espaces conviviaux', text: 'Pour échanger et collaborer' },
  { icon: ShieldCheck, title: 'Accès sécurisé', text: 'Vidéosurveillance, 24h/24' },
];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ sujet?: string }> }) {
  // « Réserver une visite » (page Services) pré-remplit le sujet : /contact?sujet=…
  const { sujet } = await searchParams;

  return (
    <section className="relative -mt-24 overflow-hidden md:-mt-28">
      <div className="mx-auto max-w-[74rem] px-4 pb-24 pt-32 md:pt-36">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-brand-orange" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">Contact</p>
            </div>
            <h1 className="mt-6 font-heading text-[clamp(2.4rem,4.6vw,3.6rem)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink-900">
              Votre prochain projet <span className="text-brand-orange">commence ici.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-ink-600">Une question, une idée ou un besoin ? Notre équipe est à votre écoute pour vous accompagner.</p>

            <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-ink-900/8 bg-white shadow-soft">
              <ul className="grid gap-px border-b border-ink-900/8 bg-ink-900/8 sm:grid-cols-2">
                {CONTACTS.map((item) => (
                  <li key={item.title} className="flex flex-col gap-1.5 bg-white p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <p className="mt-1 text-sm font-semibold text-ink-900">{item.title}</p>
                    {item.lines.map((line) => (
                      <p key={line} className="text-sm text-ink-600">
                        {line}
                      </p>
                    ))}
                    {item.action && (
                      <a
                        href={item.action.href}
                        {...(item.action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-orange hover:underline"
                      >
                        {item.action.label} <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <div className="relative">
                <iframe
                  title={`Localisation IN NETWORK — ${ADDRESS_LINE}`}
                  src={MAPS_EMBED_SRC}
                  className="h-72 w-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={MAPS_DIRECTIONS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-soft-lg hover:bg-brand-paper"
                >
                  <Navigation className="h-4 w-4 text-brand-orange" /> Voir l’itinéraire
                </a>
              </div>
              {/* Adresse sous la carte (catalogue : « à placer sous la carte »). */}
              <address className="flex items-start gap-3 border-t border-ink-900/8 px-5 py-4 not-italic">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                <span className="text-sm">
                  <span className="block font-semibold text-ink-900">IN NETWORK — {ADDRESS_LINE}</span>
                  <span className="text-ink-500">{ADDRESS_REGION}</span>
                </span>
              </address>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {VENUE_POINTS.map((point) => (
                <li key={point.title} className="flex items-start gap-2.5">
                  <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-xs text-ink-500">
                    <span className="block text-sm font-semibold text-ink-900">{point.title}</span>
                    {point.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-5">
            <div className="relative hidden aspect-[16/9] overflow-hidden rounded-[1.75rem] lg:block">
              <Image src={VENUE_PHOTOS.openSpaceVue.src} alt={VENUE_PHOTOS.openSpaceVue.alt} fill sizes="480px" className="object-cover" priority />
            </div>
            <div className="relative overflow-hidden rounded-[1.75rem] bg-ink-900 p-6 shadow-soft-lg md:p-8">
              <BrandTexture />
              <div className="relative">
              <h2 className="font-heading text-2xl font-bold text-white">Écrivez-nous</h2>
              <p className="mb-6 mt-1 text-sm text-white/65">Nous vous répondons dans les meilleurs délais.</p>
              <ContactForm defaultSubject={sujet ?? ''} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
