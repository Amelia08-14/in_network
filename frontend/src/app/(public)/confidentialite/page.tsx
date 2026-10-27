import Link from 'next/link';
import { Clock, Cookie, Database, FileText, Mail, Target, UserCheck } from 'lucide-react';

export const metadata = {
  title: 'Politique de confidentialité',
  description: 'Comment IN NETWORK collecte et utilise vos données personnelles, combien de temps elles sont conservées et comment exercer vos droits (loi n° 18-07).',
};

// Politique de confidentialité (audit du site, tâche 3.16) : structure prête,
// contenu final à valider par la direction. Ne sont décrites que les données
// que le site collecte réellement (formulaires et stockage du navigateur, cf.
// RegisterForm, ContactForm, store/cart.ts, lib/attribution.ts, lib/auth-cookies.ts).
// Les informations non encore fournies valent null et s'affichent « en cours
// de mise à jour », jamais inventées.
const PRIVACY = {
  controller: 'IN NETWORK',
  email: 'contact@in-network.dz',
  /** Durées de conservation par catégorie, à fixer par la direction. */
  retention: {
    account: null as string | null,
    requests: null as string | null,
    contact: null as string | null,
  },
  host: null as string | null,
};

const PENDING = 'en cours de mise à jour';

function Pending({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className="italic text-ink-400">{PENDING}</span>;
}

function Block({ n, icon: Icon, title, children }: { n: string; icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-ink-900/8 bg-white p-6 shadow-soft md:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-heading text-xs font-bold text-brand-orange">{n}</p>
          <h2 className="font-heading text-lg font-bold text-ink-900">{title}</h2>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <section className="relative -mt-24 md:-mt-28">
      <div className="mx-auto max-w-[56rem] px-4 pb-24 pt-32 md:pt-36">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-brand-orange" />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">Données personnelles</p>
        </div>
        <h1 className="mt-6 font-heading text-[clamp(2.2rem,4.2vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
          Politique de <span className="text-brand-orange">confidentialité</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-600">
          Cette page explique quelles données {PRIVACY.controller} recueille sur ce site, à quoi elles servent, combien de temps elles sont conservées et comment exercer vos droits, conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.
        </p>
        <p className="mt-3 inline-flex rounded-pill bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange">Document en cours de validation</p>

        <div className="mt-10 space-y-5">
          <Block n="01" icon={Database} title="Les données que nous recueillons">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-ink-800">Création de compte</strong> : nom, prénom, adresse e-mail, téléphone, type de membre et, pour une entreprise, sa raison sociale. Le mot de passe est enregistré sous forme chiffrée.
              </li>
              <li>
                <strong className="text-ink-800">Profil de l’annuaire</strong> : photo, poste, entreprise, présentation, ville, site web, LinkedIn, compétences et domaines d’activité, que vous choisissez de renseigner.
              </li>
              <li>
                <strong className="text-ink-800">Formulaire de contact</strong> : nom, adresse e-mail, téléphone (facultatif), sujet et message.
              </li>
              <li>
                <strong className="text-ink-800">Demandes de devis, réservations et paiements</strong> : les services, espaces et créneaux demandés, ainsi que les justificatifs de paiement que vous transmettez depuis votre espace.
              </li>
            </ul>
          </Block>

          <Block n="02" icon={Target} title="À quoi servent ces données">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Répondre à vos messages et à vos demandes de devis.</li>
              <li>Créer et gérer votre compte, vos abonnements, vos réservations et votre facturation.</li>
              <li>Faire apparaître votre profil dans l’annuaire des membres, après validation, et faciliter les mises en relation au sein du réseau.</li>
              <li>Vous informer des événements et de la vie du réseau IN NETWORK.</li>
            </ul>
          </Block>

          <Block n="03" icon={Clock} title="Durée de conservation">
            <dl className="space-y-1.5">
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-ink-500">Compte et profil :</dt>
                <dd className="text-ink-800"><Pending value={PRIVACY.retention.account} /></dd>
              </div>
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-ink-500">Demandes de devis, réservations et facturation :</dt>
                <dd className="text-ink-800"><Pending value={PRIVACY.retention.requests} /></dd>
              </div>
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-ink-500">Messages du formulaire de contact :</dt>
                <dd className="text-ink-800"><Pending value={PRIVACY.retention.contact} /></dd>
              </div>
            </dl>
          </Block>

          <Block n="04" icon={Cookie} title="Cookies et stockage dans votre navigateur">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-ink-800">Connexion</strong> : un cookie garde votre session ouverte lorsque vous vous connectez à votre espace.
              </li>
              <li>
                <strong className="text-ink-800">Demande de devis</strong> : les services ajoutés à votre demande restent enregistrés dans votre navigateur jusqu’à son envoi.
              </li>
              <li>
                <strong className="text-ink-800">Origine de la visite</strong> : si vous arrivez depuis un lien de campagne ou un réseau social, le nom de la campagne et le site d’origine sont conservés 60 jours dans votre navigateur, puis joints à votre inscription, votre demande de devis ou votre message.
              </li>
            </ul>
            <p>Le site n’utilise pas de cookies publicitaires.</p>
          </Block>

          <Block n="05" icon={FileText} title="Destinataires et hébergement">
            <p>Vos données sont destinées à l’équipe IN NETWORK et, pour une prestation confiée à une filiale de La Maison IN Groupe, à la filiale qui la réalise. Elles ne sont ni vendues ni louées.</p>
            <p>
              Hébergement du site : <Pending value={PRIVACY.host} />.
            </p>
          </Block>

          <Block n="06" icon={UserCheck} title="Vos droits">
            <p>
              Vous disposez d’un droit d’information, d’accès, de rectification et d’opposition sur les données qui vous concernent. Vous pouvez modifier à tout moment les informations de votre profil depuis votre espace membre.
            </p>
            <p>Vous pouvez également saisir l’Autorité nationale de protection des données à caractère personnel (ANPDP).</p>
          </Block>

          <Block n="07" icon={Mail} title="Nous contacter">
            <p>
              Pour toute question ou pour exercer vos droits, écrivez à{' '}
              <a href={`mailto:${PRIVACY.email}`} className="font-semibold text-brand-orange hover:underline">
                {PRIVACY.email}
              </a>{' '}
              ou utilisez le{' '}
              <Link href="/contact" className="font-semibold text-brand-orange hover:underline">
                formulaire de contact
              </Link>
              .
            </p>
          </Block>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          Voir aussi les{' '}
          <Link href="/mentions-legales" className="font-semibold text-brand-orange hover:underline">
            mentions légales
          </Link>{' '}
          et les{' '}
          <Link href="/cgu" className="font-semibold text-brand-orange hover:underline">
            conditions d’utilisation
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
