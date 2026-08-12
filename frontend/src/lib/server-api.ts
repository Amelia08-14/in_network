const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Fetch côté serveur pour les Server Components publics (pages catalogue en
// ISR — CDC §5.2). Ne jamais faire échouer le build/rendu si l'API est
// injoignable : on retombe sur une liste vide plutôt que de casser la page.
export async function serverGet<T>(path: string, revalidateSeconds: number, fallback: T, tag?: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: revalidateSeconds, tags: tag ? [tag] : undefined } });
    if (!res.ok) return fallback;
    const json = await res.json();
    return json.data as T;
  } catch {
    return fallback;
  }
}
