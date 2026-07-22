import { Container } from '@/components/ui/container';

export const metadata = { title: "Conditions d'utilisation" };

export default function CguPage() {
  return (
    <Container className="section-padding max-w-3xl">
      <h1 className="font-heading text-3xl font-bold text-ink-900">
        Conditions générales d'utilisation
      </h1>
      <p className="mt-6 text-sm text-ink-500">
        Contenu à rédiger avec la direction avant mise en production — cf. CDC Technique §11 et §16.1,
        dépendance ouverte (contenu légal non fourni).
      </p>
    </Container>
  );
}
