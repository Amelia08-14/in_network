import Link from 'next/link';
import { Building2, Copyright, Scale, Server, ShieldCheck, UserRound } from 'lucide-react';

export const metadata = {
  title: 'Mentions légales',
  description: 'Informations légales relatives au site IN NETWORK : éditeur, publication, hébergement, propriété intellectuelle, données personnelles et responsabilité.',
};

// Mentions légales structurées (audit du site, 25/10/2026). Les informations
// juridiques non encore fournies par la direction valent null : elles
// s'affichent « en cours de mise à jour », jamais inventées. À compléter ici
// dès réception (forme juridique, RC, NIF, directeur de la publication, hébergeur).
const LEGAL = {
  companyName: 'IN NETWORK',
  legalForm: null as string | null,
  headOffice: 'Hydra, Alger, Algérie',
  rcNumber: null as string | null,
  nifNumber: null as string | null,
  phone: '+213 5 60 06 74 86',
  email: 'contact@in-network.dz',
  publicationDirector: null as string | null,
  host: { name: null as string | null, address: null as string | null, website: null as string | null },
};

const PENDING = 'en cours de mise à jour';

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-1.5">
      <dt className="text-ink-500">{label} :</dt>
      <dd className={value ? 'text-ink-800' : 'italic text-ink-400'}>{value ?? PENDING}</dd>
    </div>
  );
}

function Block({ n, icon: Icon, title, id, children }: { n: string; icon: typeof Building2; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-[1.5rem] border border-ink-900/8 bg-white p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-heading text-xs font-bold text-brand-orange">{n}</p>
          <h2 className="font-heading text-lg font-bold text-ink-900">{title}</h2>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export default function MentionsLegalesPage() {
  return (
    <section className="relative -mt-24 md:-mt-28">
      <div className="mx-auto max-w-[74rem] px-4 pb-24 pt-32 md:pt-36">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-brand-orange" />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">Mentions légales</p>
        </div>
        <h1 className="mt-6 font-heading text-[clamp(2.2rem,4.2vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
          Mentions <span className="text-brand-orange">légales</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-600">Cette page présente les informations légales relatives au site IN NETWORK, conformément à la réglementation en vigueur en Algérie.</p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Block n="01" icon={Building2} title="Éditeur du site">
            <dl className="space-y-1">
              <Row label="Raison sociale" value={LEGAL.companyName} />
              <Row label="Forme juridique" value={LEGAL.legalForm} />
              <Row label="Siège social" value={LEGAL.headOffice} />
              <Row label="Registre du commerce" value={LEGAL.rcNumber} />
              <Row label="Identification fiscale (NIF)" value={LEGAL.nifNumber} />
              <Row label="Téléphone" value={LEGAL.phone} />
              <Row label="E-mail" value={LEGAL.email} />
            </dl>
          </Block>

          <Block n="02" icon={UserRound} title="Directeur de la publication">
            <dl className="space-y-1">
              <Row label="Nom" value={LEGAL.publicationDirector} />
              <Row label="Contact" value={LEGAL.email} />
            </dl>
          </Block>

          <Block n="03" icon={Server} title="Hébergement">
            <dl className="space-y-1">
              <Row label="Hébergeur" value={LEGAL.host.name} />
              <Row label="Adresse" value={LEGAL.host.address} />
              <Row label="Site web" value={LEGAL.host.website} />
            </dl>
          </Block>

          <Block n="04" icon={Copyright} title="Propriété intellectuelle">
            <p>
              L’ensemble des contenus présents sur ce site (textes, images, logos, vidéos, éléments graphiques…) sont la propriété d’IN NETWORK ou de leurs titulaires respectifs.
            </p>
            <p>Toute reproduction, représentation, modification ou utilisation, totale ou partielle, est interdite sans autorisation préalable.</p>
          </Block>

          <Block n="05" icon={ShieldCheck} title="Données personnelles" id="donnees-personnelles">
            <p>
              Les informations recueillies sur ce site (formulaire de contact, création de compte, demande de devis…) sont destinées à IN NETWORK pour le traitement de vos demandes et la gestion de la relation avec ses utilisateurs.
            </p>
            <p>
              Conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel, vous disposez d’un droit d’accès, de rectification et d’opposition. Pour l’exercer, écrivez à{' '}
              <a href={`mailto:${LEGAL.email}`} className="font-semibold text-brand-orange hover:underline">
                {LEGAL.email}
              </a>
              .
            </p>
            <p>
              Le détail figure dans notre{' '}
              <Link href="/confidentialite" className="font-semibold text-brand-orange hover:underline">
                politique de confidentialité
              </Link>
              .
            </p>
          </Block>

          <Block n="06" icon={Scale} title="Responsabilité">
            <p>IN NETWORK s’efforce d’assurer l’exactitude des informations diffusées sur ce site, sans pouvoir être tenu responsable des erreurs, omissions ou d’une indisponibilité temporaire du site.</p>
            <p>Les tarifs affichés sont indicatifs : seul le devis transmis par l’équipe IN NETWORK engage les parties.</p>
          </Block>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          Voir aussi les{' '}
          <Link href="/cgu" className="font-semibold text-brand-orange hover:underline">
            conditions d’utilisation
          </Link>{' '}
          du site et la{' '}
          <Link href="/confidentialite" className="font-semibold text-brand-orange hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
