import { Container } from '@/components/ui/container';

export const metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <Container className="section-padding max-w-3xl">
      <h1 className="font-heading text-3xl font-bold text-ink-900">Mentions légales</h1>
      <p className="mt-6 text-sm text-ink-500">
        Contenu à finaliser avec la direction (raison sociale, numéro RC, siège social, directeur de la
        publication, hébergeur) — cf. CDC Technique §11 et §16.1, dépendance ouverte.
      </p>
    </Container>
  );
}
