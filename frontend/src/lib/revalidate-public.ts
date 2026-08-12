// Déclenche le rafraîchissement immédiat du cache ISR des pages publiques
// (ne pas attendre le délai de revalidation) — à appeler en onSuccess des
// mutations admin qui touchent un contenu affiché côté public.
export function revalidatePublic(tag: string) {
  fetch(`/api/revalidate?tag=${encodeURIComponent(tag)}`, { method: 'POST' }).catch(() => {});
}
