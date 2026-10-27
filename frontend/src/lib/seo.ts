// Balises meta des pages dynamiques (audit 27/10/2026) : chaque fiche porte
// son propre titre — le gabarit « %s — IN NETWORK » du layout racine ajoute le
// suffixe, il ne faut donc jamais l'écrire dans le titre — et sa propre
// description.

/** Description meta : texte brut, sans puces, coupé au mot vers 160 caractères. */
export function metaDescription(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/^•\s*/gm, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—-]+$/, '')}…`;
}
