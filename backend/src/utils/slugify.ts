// Slug URL-safe à partir d'un texte libre (raison sociale d'entreprise, etc.).
// Retire les diacritiques, réduit tout ce qui n'est pas alphanumérique à un
// tiret unique, borne la longueur.
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
  return base || 'entreprise';
}

// Rend le slug unique en suffixant `-2`, `-3`… tant que `exists(candidate)`
// renvoie true. `exists` fait généralement un `findUnique` en base.
export async function uniqueSlug(
  input: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(input);
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
