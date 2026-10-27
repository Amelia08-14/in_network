// Mise en forme à l'affichage des champs saisis librement par les membres
// (audit 27/10/2026) : « alger » ou « ALGER » → « Alger », « founder » →
// « Founder ». Les données saisies ne sont pas modifiées.

const SMALL_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'el', 'et', 'sur', 'en']);

/** Ville : majuscule à chaque mot (« bordj bou arreridj » → « Bordj Bou Arreridj »), petits mots en minuscules. */
export function formatCity(city: string | null | undefined): string | null {
  const clean = city?.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  return clean
    .toLocaleLowerCase('fr-FR')
    .split(/([\s-])/)
    .map((part, i) => (i > 0 && SMALL_WORDS.has(part) ? part : part.charAt(0).toLocaleUpperCase('fr-FR') + part.slice(1)))
    .join('');
}

/** Poste : majuscule initiale ; un intitulé tout en capitales est ramené en minuscules (les sigles courts sont gardés). */
export function formatJobTitle(title: string | null | undefined): string | null {
  const clean = title?.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const shouting = clean.length > 4 && clean === clean.toLocaleUpperCase('fr-FR') && /\p{L}{5,}/u.test(clean);
  const base = shouting ? clean.toLocaleLowerCase('fr-FR') : clean;
  return base.charAt(0).toLocaleUpperCase('fr-FR') + base.slice(1);
}
