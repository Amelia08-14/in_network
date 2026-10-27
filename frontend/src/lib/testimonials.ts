// Témoignages de l'accueil (GET /api/testimonials).
//
// Doublons (audit 27/10/2026) : le seed a recréé en septembre trois
// témoignages « Membre IN NETWORK » (uploads/sites/testimonial-N.mp4) alors
// que les mêmes vidéos avaient déjà été publiées depuis l'admin avec le
// prénom du membre (uploads/testimonials/<uuid>.mp4). Les fichiers sont
// identiques mais leurs URL diffèrent : on reconnaît donc un doublon à sa
// première phrase, et on garde la version signée d'un prénom.

export interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string | null;
  authorContext?: string | null;
  content: string | null;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
}

/** Signature générique du seed, sans prénom. */
export const GENERIC_AUTHOR = 'Membre IN NETWORK';

const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;

/**
 * Citation affichable : les textes viennent de légendes Instagram coupées en
 * pleine phrase (« …l'expérience »). On garde les phrases complètes ; à défaut
 * de point final, on coupe au dernier mot entier avec « … ».
 */
export function completeQuote(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (/[.!?…»]$/.test(clean)) return clean;
  const lastEnd = Math.max(clean.lastIndexOf('. '), clean.lastIndexOf('! '), clean.lastIndexOf('? '), clean.lastIndexOf('… '));
  if (lastEnd > 0) return clean.slice(0, lastEnd + 1);
  const lastSpace = clean.lastIndexOf(' ');
  return `${lastSpace > 0 ? clean.slice(0, lastSpace) : clean}…`;
}

const firstSentenceKey = (text: string | null) =>
  (completeQuote(text) ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 80);

/** Une seule entrée par témoignage, la version avec prénom en priorité, citations complètes. */
export function uniqueTestimonials(items: Testimonial[]): Testimonial[] {
  const named = [...items].sort((a, b) => Number(a.authorName === GENERIC_AUTHOR) - Number(b.authorName === GENERIC_AUTHOR));
  const seen = new Set<string>();
  const kept = named.filter((t) => {
    const keys = [t.videoUrl ? `v:${t.videoUrl}` : null, t.content ? `t:${firstSentenceKey(t.content)}` : null].filter(Boolean) as string[];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
  // Ordre d'origine de l'API (le plus récent d'abord).
  return items.filter((t) => kept.includes(t)).map((t) => ({ ...t, content: completeQuote(t.content) }));
}
