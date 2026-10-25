'use client';

import Link from 'next/link';
import { Briefcase, Building2, Lock } from 'lucide-react';
import { useAdminAuthStore } from '@/store/admin-auth';
import { HUE } from '@/lib/palette';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'catalogue', href: '/admin/services', label: 'Catalogue de services', hint: 'Secrétariat, création, comptabilité…', icon: Briefcase, hue: 'orange' as const, resources: ['services'] },
  { key: 'tarifs', href: '/admin/tarifs', label: 'Formules, espaces & salles', hint: 'Abonnements et tarifs des salles', icon: Building2, hue: 'blue' as const, resources: ['plans', 'spaces'] },
];

/** Le catalogue (services, formules, tarifs) se crée et se modifie par la Direction seulement. */
export function useCanEditCatalogue() {
  const role = useAdminAuthStore((s) => s.user?.role);
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// Services et tarifs forment une seule offre (cf. la page publique
// /services) : un seul onglet du menu, deux vues qui se répondent. Un compte
// restreint ne voit que la vue pour laquelle il a un droit.
export function ServicesTarifsHeader({ active }: { active: 'catalogue' | 'tarifs' }) {
  const user = useAdminAuthStore((s) => s.user);
  const full = useCanEditCatalogue();
  const permissions = (user?.permissions ?? {}) as Record<string, string>;
  const visible = TABS.filter((tab) => full || tab.resources.some((r) => Boolean(permissions[r])));

  return (
    <div className="space-y-5">
      <div>
        <span aria-hidden className="mb-2 block h-1 w-10 rounded-full bg-brand-orange" />
        <h1 className="font-heading text-2xl font-bold text-ink-900">Services & tarifs</h1>
        <p className="mt-1 text-sm text-ink-500">Le catalogue de services et la grille tarifaire des entreprises : une seule offre, présentée telle quelle sur le site.</p>
        {!full && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-ink-900/[0.05] px-3 py-2 text-sm text-ink-700">
            <Lock className="h-4 w-4 text-ink-500" /> Consultation seule : le catalogue et les tarifs sont créés et modifiés par la Direction.
          </p>
        )}
      </div>
      {visible.length > 1 && (
        <nav aria-label="Vues Services et tarifs" className="flex flex-wrap gap-3">
          {visible.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                  isActive ? cn(HUE[tab.hue].soft, HUE[tab.hue].border) : 'border-ink-900/10 bg-white hover:bg-ink-900/3',
                )}
              >
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', isActive ? HUE[tab.hue].solid : HUE[tab.hue].soft, isActive ? 'text-white' : HUE[tab.hue].text)}>
                  <tab.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className={cn('block text-sm font-bold', isActive ? HUE[tab.hue].text : 'text-ink-900')}>{tab.label}</span>
                  <span className="block text-xs text-ink-500">{tab.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
