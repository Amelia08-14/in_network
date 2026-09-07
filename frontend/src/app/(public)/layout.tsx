import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { SmoothScroll } from '@/components/layout/SmoothScroll';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 pt-24 md:pt-28">{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </SmoothScroll>
  );
}
