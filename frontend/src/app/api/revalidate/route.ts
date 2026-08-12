import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Appelé depuis le dashboard Admin après création/publication/modification
// d'un contenu public (événement, expert, partenaire, service...) — les pages
// publiques utilisent le cache ISR de Next.js (`next.revalidate`), qui sans
// cet appel ne se rafraîchit qu'après expiration du délai (jusqu'à 1h),
// ce qui donnait l'impression qu'un contenu publié "n'apparaissait pas".
export async function POST(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag');
  if (!tag) {
    return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
  }
  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag });
}
