'use client';

import { useSyncExternalStore } from 'react';

// « Maintenant » pour les écrans qui comparent des échéances (retards, actions
// en retard) : lu via useSyncExternalStore plutôt que Date.now() dans le rendu
// (impur), et rafraîchi chaque minute. Côté serveur la valeur est 0 : les
// comparaisons ne signalent alors aucun retard, puis se corrigent au montage.
let current = 0;

function subscribe(onChange: () => void) {
  const id = window.setInterval(() => {
    current = Date.now();
    onChange();
  }, 60_000);
  return () => window.clearInterval(id);
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => (current ||= Date.now()),
    () => 0,
  );
}
