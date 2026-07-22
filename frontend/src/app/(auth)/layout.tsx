import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Panneau de marque — sobre, visible en desktop */}
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-ink-900 p-12 text-white lg:flex">
        <Logo variant="light" priority />

        <div className="max-w-sm">
          <span className="eyebrow text-white/60">IN NETWORK</span>
          <p className="mt-5 font-heading text-3xl font-bold leading-tight">
            Le lieu et le réseau qui font avancer les entrepreneurs.
          </p>
          <p className="mt-4 leading-relaxed text-white/60">
            Hydra, Alger — coworking, mise en réseau ciblée et services
            entrepreneuriaux réunis en un seul endroit.
          </p>
        </div>

        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} IN NETWORK — La Maison IN Groupe.
        </p>
      </aside>

      {/* Colonne formulaire */}
      <div className="flex flex-1 flex-col bg-white">
        <header className="flex items-center justify-between px-6 py-5 lg:px-10">
          <span className="lg:hidden">
            <Logo priority />
          </span>
          <span className="hidden lg:block" aria-hidden />
          <Link href="/" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            Retour au site
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
