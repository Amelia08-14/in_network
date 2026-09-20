import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Appelé depuis le dashboard Admin après création/publication/modification
// d'un contenu public (événement, expert, partenaire, service...) — les pages
// publiques utilisent le cache ISR de Next.js (`next.revalidate`), qui sans
// cet appel ne se rafraîchit qu'après expiration du délai (jusqu'à 1h),
// ce qui donnait l'impression qu'un contenu publié "n'apparaissait pas".
//
// Migration Next.js 16 (§0 brief) : `revalidateTag(tag)` seul est retiré —
// il faut désormais passer un profil. `updateTag` serait idéal (invalidation
// immédiate) mais n'est autorisé que dans une Server Action : dans un Route
// Handler il lève une erreur (500, le cache n'était donc jamais invalidé).
// `{ expire: 0 }` donne ici l'invalidation immédiate voulue : un admin qui
// vient de publier voit le résultat tout de suite, sans servir l'ancienne
// version le temps d'un rafraîchissement en arrière-plan.
export async function POST(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag');
  if (!tag) {
    return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
  }
  revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: true, tag });
}
