'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShoppingBasket, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth';
import { useCart, type CartItem } from '@/store/cart';
import { api, ApiRequestError } from '@/lib/api';
import { formatDzd, PRICE_UNIT_SUFFIX, summarizeAmounts } from '@/lib/quote';
import { cn } from '@/lib/utils';
import { CART_KIND_HUE, HUE, SERVICE_HUE, type Hue } from '@/lib/palette';
import { CATEGORY_LABEL } from '@/components/features/ServiceCard';

// Teinte et libellé de la ligne : catégorie du service, formule ou salle.
function itemKind(item: CartItem): { hue: Hue; label: string } {
  if (item.category === 'PLAN') return { hue: CART_KIND_HUE.PLAN, label: 'Formule' };
  if (item.category === 'SPACE') return { hue: CART_KIND_HUE.SPACE, label: 'Salle de réunion' };
  const category = item.category ?? '';
  return { hue: SERVICE_HUE[category] ?? 'gray', label: CATEGORY_LABEL[category] ?? 'Service' };
}

function priceLabel(item: CartItem): string {
  if (item.price == null) return item.targetType === 'SPACE' ? 'Selon la durée' : 'Sur devis';
  const suffix = item.priceUnit ? ` ${PRICE_UNIT_SUFFIX[item.priceUnit] ?? ''}` : '';
  return `${formatDzd(item.price)}${suffix}`;
}

// Panier de demande de devis : le visiteur compose sa demande (services,
// formules d'abonnement, salles) sans compte ; l'envoi exige d'être connecté
// (POST /api/services/requests) — le panier reste dans le navigateur pendant
// la connexion ou l'inscription.
export function QuoteCart() {
  const { items, mounted, remove, clear } = useCart();
  const status = useAuthStore((s) => s.status);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; profileIncomplete: boolean } | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/api/services/requests', {
        items: items.map(({ targetType, targetId, tierLabel }) => ({ targetType, targetId, tierLabel })),
        notes: notes.trim() || undefined,
      });
      setSentCount(items.length);
      clear();
      setNotes('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError({ message: err.message, profileIncomplete: err.code === 'PROFILE_INCOMPLETE' });
      } else {
        setError({ message: "Impossible d'envoyer la demande, réessaie.", profileIncomplete: false });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) {
    return <p className="text-sm text-ink-500">Chargement de ta demande…</p>;
  }

  if (sentCount !== null) {
    return (
      <Card accent="green">
        <CardContent className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-accent-green" />
            <p className="font-heading text-xl font-bold text-ink-900">Demande envoyée</p>
          </div>
          <p className="text-ink-600">
            Ta demande de devis ({sentCount} ligne{sentCount > 1 ? 's' : ''}) est bien arrivée. L’équipe IN NETWORK la
            chiffre et te recontacte rapidement — tu retrouves son suivi dans ton espace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/reservations" className={buttonVariants({ variant: 'primary', size: 'md' })}>
              Suivre mes demandes
            </Link>
            <Link href="/services" className={buttonVariants({ variant: 'outline', size: 'md' })}>
              Continuer à parcourir
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Ta demande de devis est vide"
        description="Ajoute des services, des formules ou des salles : tu pourras tout envoyer en une seule demande."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/services#services" className={buttonVariants({ variant: 'primary', size: 'md' })}>
              Parcourir les services
            </Link>
            <Link href="/services#espaces" className={buttonVariants({ variant: 'outline', size: 'md' })}>
              Voir les abonnements
            </Link>
          </div>
        }
      />
    );
  }

  const { rows, unpriced } = summarizeAmounts(items.map((i) => ({ amount: i.price, unit: i.priceUnit })));
  const canSend = status === 'authenticated';

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-label="Lignes de la demande">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.key}>
              <Card className={cn('border-l-4', HUE[itemKind(item).hue].edge)}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <span className={cn('mb-1 inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', HUE[itemKind(item).hue].soft, HUE[itemKind(item).hue].text)}>
                      {itemKind(item).label}
                    </span>
                    <p className="font-heading text-base font-bold text-ink-900">{item.title}</p>
                    {item.tierLabel && <p className="mt-0.5 text-sm text-ink-500">{item.tierLabel}</p>}
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-right text-sm font-semibold tabular-nums',
                      item.price == null ? 'text-ink-500' : 'text-ink-900',
                    )}
                  >
                    {priceLabel(item)}
                  </p>
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    aria-label={`Retirer ${item.title}${item.tierLabel ? ` — ${item.tierLabel}` : ''} de la demande`}
                    className="shrink-0 rounded-full p-2 text-ink-400 transition-colors hover:bg-brand-orange/10 hover:text-brand-orange"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <Link href="/services" className="font-medium text-brand-blue hover:underline">
            + Ajouter d’autres services
          </Link>
          <button type="button" onClick={clear} className="text-ink-500 hover:text-brand-orange">
            Vider la demande
          </button>
        </div>
      </section>

      <aside className="lg:sticky lg:top-32">
        <Card accent="orange">
          <CardContent className="flex flex-col gap-5">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink-900">
                Récapitulatif — {items.length} ligne{items.length > 1 ? 's' : ''}
              </h2>
              {rows.length > 0 && (
                <dl className="mt-3 space-y-1.5 text-sm">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-baseline justify-between gap-3">
                      <dt className="flex items-center gap-2 text-ink-600">
                        <span aria-hidden className={cn('h-2 w-2 rounded-full', row.key === 'ONE_TIME' ? HUE.orange.solid : HUE.blue.solid)} />
                        {row.label}
                      </dt>
                      <dd className="font-heading text-base font-bold tabular-nums text-ink-900">
                        {formatDzd(row.amount)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {unpriced > 0 && (
                <p className="mt-2 text-sm text-ink-600">
                  {unpriced} ligne{unpriced > 1 ? 's' : ''} sur devis, chiffrée{unpriced > 1 ? 's' : ''} par l’équipe.
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                Montants indicatifs : le devis définitif t’est envoyé par l’équipe IN NETWORK après étude de ta demande.
              </p>
            </div>

            <div>
              <Label htmlFor="quote-notes">Précisions (optionnel)</Label>
              <Textarea
                id="quote-notes"
                rows={4}
                maxLength={2000}
                placeholder="Ton activité, tes délais, tes questions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-brand-orange" role="alert">
                {error.message}{' '}
                {error.profileIncomplete && (
                  <Link href="/dashboard/profil" className="font-medium underline">
                    Compléter mon profil
                  </Link>
                )}
              </p>
            )}

            {canSend ? (
              <Button variant="primary" size="lg" className="w-full" disabled={isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? 'Envoi…' : 'Envoyer ma demande de devis'}
              </Button>
            ) : status === 'unauthenticated' ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-600">
                  Connecte-toi pour envoyer ta demande — ton panier est conservé.
                </p>
                <Link
                  href="/login?redirect=/devis"
                  className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}
                >
                  Se connecter pour envoyer
                </Link>
                <Link
                  href="/register"
                  className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'w-full')}
                >
                  Créer un compte
                </Link>
              </div>
            ) : (
              <Button variant="primary" size="lg" className="w-full" disabled>
                Chargement…
              </Button>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
