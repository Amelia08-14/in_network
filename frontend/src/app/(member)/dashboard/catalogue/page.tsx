'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardList, Search, ShoppingBasket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { CATEGORY_LABEL, ServiceCard } from '@/components/features/ServiceCard';
import { api } from '@/lib/api';
import { itemLabel, requestSummary, type QuoteItem } from '@/lib/quote';
import { sortServices } from '@/lib/services-order';
import { cn } from '@/lib/utils';
import { useCart } from '@/store/cart';
import type { MembershipPlan, ServiceCatalogItem } from '@/types';

interface ServiceRequest {
  id: string;
  createdAt: string;
  status: string;
  notes: string | null;
  adminDetails: string | null;
  quotedAmount: string | null;
  quotedCurrency: string;
  confirmedAt: string | null;
  items: QuoteItem[];
}

const REQUEST_STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'startup'> = { NEW: 'neutral', IN_PROGRESS: 'success', DONE: 'success', CANCELLED: 'startup' };
const REQUEST_STATUS_LABEL: Record<string, string> = { NEW: 'Reçue', IN_PROGRESS: 'En cours de traitement', DONE: 'Traitée', CANCELLED: 'Annulée' };
const CYCLE: Record<string, string> = { DAY_PASS: '/ jour', MONTHLY: '/ mois', ANNUAL: '/ an' };

const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// « Demander un service » (processus v1.3, espace client, fonction 2) : le même
// catalogue que le site public (offres, services, formules), le même panier de
// devis. Ouvert dès l'inscription. Pour un membre actif, la demande devient un
// lead « Extension » rattaché à sa fiche : à tarif défini, le devis est généré
// et envoyé tout de suite ; sinon l'équipe établit le devis.
export default function MemberCataloguePage() {
  const { items: cart } = useCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const { data: services, isLoading } = useQuery({
    queryKey: ['catalogue-services'],
    queryFn: () => api.get<{ data: ServiceCatalogItem[] }>('/api/services').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: plans } = useQuery({
    queryKey: ['catalogue-plans'],
    queryFn: () => api.get<{ data: MembershipPlan[] }>('/api/plans').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: requests } = useQuery({
    queryKey: ['my-service-requests'],
    queryFn: () => api.get<{ data: ServiceRequest[] }>('/api/services/requests/mine').then((r) => r.data),
  });

  const q = normalize(search.trim());
  const sortedServices = useMemo(() => sortServices(services ?? []), [services]);
  const categories = useMemo(() => {
    const present = new Set(sortedServices.map((s) => s.category));
    return [...present].map((value) => ({ value, label: CATEGORY_LABEL[value] ?? value }));
  }, [sortedServices]);

  const visibleServices = sortedServices.filter((s) => (category === 'ALL' || s.category === category) && (!q || normalize(`${s.title} ${s.description}`).includes(q)));
  const visiblePlans = (plans ?? []).filter((p) => (category === 'ALL' || category === 'PLAN') && (!q || normalize(`${p.name} ${p.features.join(' ')}`).includes(q)));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">Services</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-ink-900">Demander un service</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Ajoutez à votre demande ce qui vous intéresse (offres, services, abonnements) puis envoyez-la en une fois. À tarif défini, votre devis arrive aussitôt dans « Devis et factures » ; pour une prestation sur mesure, l’équipe vous le prépare.
          </p>
        </div>
        <Link href="/devis" className={cn(buttonVariants({ variant: cart.length ? 'primary' : 'outline', size: 'lg' }), 'gap-2')}>
          <ShoppingBasket className="h-4 w-4" />
          Ma demande{cart.length > 0 && ` (${cart.length})`}
        </Link>
      </div>

      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input aria-label="Rechercher un service" className="pl-9" placeholder="Rechercher (domiciliation, création, secrétariat…)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories">
          {[{ value: 'ALL', label: 'Tout' }, ...categories, ...(plans?.length ? [{ value: 'PLAN', label: 'Formules & abonnements' }] : [])].map((c) => (
            <button key={c.value} type="button" aria-pressed={category === c.value} onClick={() => setCategory(c.value)} className={cn('rounded-pill border px-4 py-2 text-sm font-semibold transition-colors', category === c.value ? 'border-transparent bg-ink-900 text-white' : 'border-ink-900/10 bg-white text-ink-700 hover:bg-ink-900/5')}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Chargement du catalogue…</p>
      ) : visibleServices.length === 0 && visiblePlans.length === 0 ? (
        <EmptyState title="Aucun résultat" description="Essayez un autre mot-clé ou une autre catégorie." />
      ) : (
        <>
          {visibleServices.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}

          {visiblePlans.length > 0 && (
            <section aria-labelledby="plans-title" className="space-y-4">
              <h2 id="plans-title" className="font-heading text-lg font-bold text-ink-900">Formules & abonnements</h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visiblePlans.map((plan) => (
                  <Card key={plan.id} accent="blue">
                    <CardContent className="flex h-full flex-col gap-4">
                      <div>
                        <h3 className="font-heading text-lg font-bold text-ink-900">{plan.name}</h3>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="font-heading text-2xl font-bold text-ink-900">{Number(plan.price).toLocaleString('fr-FR')}</span>
                          <span className="text-xs font-semibold text-ink-500">{plan.currency} {CYCLE[plan.billingCycle]}</span>
                        </p>
                      </div>
                      <ul className="space-y-1.5 text-sm text-ink-600">
                        {plan.features.slice(0, 5).map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" /> {f}
                          </li>
                        ))}
                      </ul>
                      <AddToCartButton
                        className="mt-auto w-full"
                        variant="outline"
                        item={{ targetType: 'PLAN', targetId: plan.id, title: plan.name, price: Number(plan.price), priceUnit: plan.billingCycle, category: 'PLAN' }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="requests-title" className="space-y-4">
        <h2 id="requests-title" className="flex items-center gap-2 font-heading text-lg font-bold text-ink-900">
          <ClipboardList className="h-5 w-5 text-ink-500" /> Mes demandes de devis
        </h2>
        {!requests || requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucune demande envoyée" description="Vos demandes apparaissent ici avec leur avancement et le montant du devis une fois chiffré." className="py-10" />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-ink-900/8">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-800">{requestSummary(r.items)}</p>
                      {r.items.length > 1 && (
                        <ul className="mt-1 list-inside list-disc text-xs text-ink-500">
                          {r.items.map((item) => (
                            <li key={item.id}>{itemLabel(item)}</li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-xs text-ink-500">Envoyée le {new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      {r.quotedAmount != null && (
                        <p className="mt-1 text-xs font-semibold text-ink-900">Devis : {Number(r.quotedAmount).toLocaleString('fr-FR')} {r.quotedCurrency}</p>
                      )}
                      {r.confirmedAt && r.adminDetails && <p className="mt-1 whitespace-pre-line text-xs text-ink-500">{r.adminDetails}</p>}
                    </div>
                    <Badge variant={REQUEST_STATUS_VARIANT[r.status] ?? 'neutral'}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <p className="text-xs text-ink-500">
          Vos devis à confirmer, vos proformas et vos factures sont dans{' '}
          <Link href="/dashboard/documents" className="font-semibold text-brand-blue hover:underline">
            Devis et factures
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
