import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuoteCart } from '@/components/features/QuoteCart';

export const metadata = { title: 'Ma demande de devis' };

export default function QuotePage() {
  return (
    <Container className="section-padding">
      <PageHeader
        eyebrow="Devis"
        title={
          <>
            Ma demande de <span className="text-brand-orange">devis</span>
          </>
        }
        description="Réunis tout ce dont tu as besoin — services, formules, salles — dans une seule demande. L’équipe IN NETWORK te répond avec un devis unique."
      />
      <QuoteCart />
    </Container>
  );
}
