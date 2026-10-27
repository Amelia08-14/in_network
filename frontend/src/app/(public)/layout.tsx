import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { LOCAL_BUSINESS_JSON_LD } from '@/lib/site-info';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      {/* Données structurées LocalBusiness : adresse, téléphone, coordonnées GPS (référencement local). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSON_LD) }} />
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 pt-24 md:pt-28">{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </SmoothScroll>
  );
}
