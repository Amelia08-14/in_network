'use client';

import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
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
