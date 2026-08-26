import { NextRequest, NextResponse } from 'next/server';
import { updateTag } from 'next/cache';

// Appelé depuis le dashboard Admin après création/publication/modification
// d'un contenu public (événement, expert, partenaire, service...) — les pages
// publiques utilisent le cache ISR de Next.js (`next.revalidate`), qui sans
// cet appel ne se rafraîchit qu'après expiration du délai (jusqu'à 1h),
// ce qui donnait l'impression qu'un contenu publié "n'apparaissait pas".
//
// Migration Next.js 16 (§0 brief) : `revalidateTag(tag)` seul est retiré —
// il faut désormais choisir entre revalidateTag(tag, profile) (invalidation
// "éventuelle" : le prochain visiteur peut encore voir l'ancienne version le
// temps qu'un rafraîchissement en arrière-plan se termine) et updateTag(tag)
// (invalidation immédiate/bloquante). Le but exact de cette route est qu'un
// admin qui vient de publier voie le résultat tout de suite — le cas d'usage
// canonique d'updateTag, pas de revalidateTag qui recréerait le bug d'origine.
export async function POST(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag');
  if (!tag) {
    return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
  }
  updateTag(tag);
  return NextResponse.json({ revalidated: true, tag });
}
