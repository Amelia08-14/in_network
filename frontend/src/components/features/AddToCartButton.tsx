'use client';

import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { CURRENCY, formatNumber } from '@/lib/money';
import { cartItemKey, useCart, type CartItemInput } from '@/store/cart';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps {
  item: CartItemInput;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'link';
  size?: 'sm' | 'md' | 'lg';
  /** Petit bouton rond « + » pour les lignes de tarif (palier) d'une carte. */
  compact?: boolean;
  className?: string;
}

// Ajoute une ligne (service + palier, salle ou formule) à la demande de devis.
// Une fois ajoutée, le bouton devient un lien vers /devis : retirer ou
// modifier se fait depuis la demande, pas depuis la carte.
export function AddToCartButton({
  item,
  label = 'Ajouter au devis',
  variant = 'outline',
  size = 'md',
  compact = false,
  className,
}: AddToCartButtonProps) {
  const { add, has } = useCart();
  const inCart = has(cartItemKey(item));
  const name = item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title;

  if (compact) {
    return inCart ? (
      <Link
        href="/devis"
        aria-label={`${name} : ajouté, voir ma demande de devis`}
        title="Ajouté — voir ma demande"
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-green/20 text-green-800 transition-colors hover:bg-accent-green/30',
          className,
        )}
      >
        <Check className="h-4 w-4" />
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => add(item)}
        aria-label={`Ajouter ${name} au devis`}
        title="Ajouter au devis"
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-900/15 text-ink-900 transition-colors hover:border-brand-orange hover:bg-brand-orange hover:text-white',
          className,
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  if (inCart) {
    return (
      <Link
        href="/devis"
        className={cn(buttonVariants({ variant: 'outline', size }), 'gap-2 border-accent-green/60 text-green-800', className)}
      >
        <Check className="h-4 w-4" /> Ajouté — voir ma demande
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => add(item)} className={cn(buttonVariants({ variant, size }), 'gap-2', className)}>
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

/**
 * Ligne de tarif entièrement cliquable (retours cliente du 05/11/2026) :
 * « libellé · prix · Ajouter ». Toute la case ajoute le palier à la demande de
 * devis ; une fois ajouté, elle mène à la demande.
 */
export function AddTierRow({
  item,
  label,
  price,
  className,
  tone = 'orange',
}: {
  item: CartItemInput;
  label: string;
  price: number;
  className?: string;
  tone?: 'orange' | 'ink';
}) {
  const { add, has } = useCart();
  const inCart = has(cartItemKey(item));
  const name = item.tierLabel ? `${item.title} — ${item.tierLabel}` : item.title;
  const base = cn(
    'group/tier flex w-full items-center gap-3 rounded-xl border py-2 pl-3.5 pr-2 text-left transition-colors',
    inCart
      ? 'border-accent-green/50 bg-accent-green/10'
      : tone === 'orange'
        ? 'border-brand-orange/25 bg-brand-orange/10 hover:border-brand-orange hover:bg-brand-orange/15'
        : 'border-ink-900/15 bg-ink-900/[0.06] hover:border-ink-900/40 hover:bg-ink-900/10',
    className,
  );
  const body = (
    <>
      <span className="min-w-0 flex-1 text-sm font-medium text-ink-700">{label}</span>
      <span className="shrink-0 whitespace-nowrap font-heading font-bold tabular-nums text-ink-900">
        {formatNumber(price)}
        <span className={cn('ml-1 text-xs font-semibold', tone === 'orange' ? 'text-brand-orange' : 'text-ink-600')}>{CURRENCY}</span>
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
          inCart ? 'bg-accent-green/25 text-green-800' : 'bg-white text-ink-900 ring-1 ring-ink-900/15 group-hover/tier:bg-brand-orange group-hover/tier:text-white group-hover/tier:ring-brand-orange',
        )}
      >
        {inCart ? (
          <>
            <Check className="h-3.5 w-3.5" /> Ajouté
          </>
        ) : (
          'Ajouter'
        )}
      </span>
    </>
  );
  return inCart ? (
    <Link href="/devis" className={base} aria-label={`${name} : ajouté, voir ma demande de devis`}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={() => add(item)} className={base} aria-label={`Ajouter ${name} au devis`}>
      {body}
    </button>
  );
}
