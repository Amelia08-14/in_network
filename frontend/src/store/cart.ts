'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuoteTargetType } from '@/lib/quote';

// Panier de demande de devis : se remplit sans compte (localStorage), ne
// s'envoie qu'une fois connecté (POST /api/services/requests). Le prix stocké
// ici n'est qu'un repère d'affichage — le backend relit libellés et tarifs
// en base à l'envoi.
export interface CartItem {
  /** targetType:targetId:tierLabel — identifie la ligne (pas de doublon). */
  key: string;
  targetType: QuoteTargetType;
  targetId: string;
  title: string;
  tierLabel?: string;
  /** Catégorie du service, « PLAN » ou « SPACE » : sert uniquement à la couleur. */
  category?: string;
  /** null = sur devis (ou grille horaire d'une salle). */
  price: number | null;
  /** MONTHLY / ANNUAL / DAY_PASS pour une formule ; absent pour un service. */
  priceUnit?: string;
}

export type CartItemInput = Omit<CartItem, 'key'>;

export function cartItemKey(item: Pick<CartItem, 'targetType' | 'targetId' | 'tierLabel'>): string {
  return `${item.targetType}:${item.targetId}:${item.tierLabel ?? ''}`;
}

interface CartState {
  items: CartItem[];
  add: (item: CartItemInput) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => {
          const key = cartItemKey(item);
          return state.items.some((i) => i.key === key) ? state : { items: [...state.items, { ...item, key }] };
        }),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'in-network-cart', version: 1 },
  ),
);

const noopSubscribe = () => () => {};

/**
 * Accès au panier côté composants. Le contenu vient du localStorage, absent
 * du rendu serveur : tant que le composant n'est pas monté on expose un panier
 * vide (`mounted: false`), pour éviter un écart d'hydratation.
 */
export function useCart() {
  const state = useCartStore();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return {
    items: mounted ? state.items : [],
    mounted,
    add: state.add,
    remove: state.remove,
    clear: state.clear,
    has: (key: string) => mounted && state.items.some((i) => i.key === key),
  };
}
