'use client';

import Link from 'next/link';
import { ShoppingBasket } from 'lucide-react';
import { useCart } from '@/store/cart';
import { cn } from '@/lib/utils';

// Accès à la demande de devis depuis la nav, avec le nombre de lignes. Le
// badge n'apparaît qu'une fois le panier lu depuis le navigateur.
export function CartLink({ className, label }: { className?: string; label?: string }) {
  const { items } = useCart();
  const count = items.length;

  return (
    <Link
      href="/devis"
      aria-label={count > 0 ? `Ma demande de devis, ${count} ligne${count > 1 ? 's' : ''}` : 'Ma demande de devis'}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-full p-2 text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900',
        className,
      )}
    >
      <ShoppingBasket className="h-5 w-5" />
      {label && <span className="text-sm font-medium">{label}</span>}
      {count > 0 && (
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-bold leading-none text-white',
            !label && 'absolute -right-1 -top-1',
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
