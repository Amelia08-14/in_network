import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';
import { scoreMatch, type MatchCandidate } from '../src/lib/matching/engine';

// Diagnostic du matching, en LECTURE SEULE : pour chaque membre, ce que le moteur
// voit (domaines, compétences, profil validé ou non) et ses meilleurs scores.
//   npm run matching:diagnostic            tous les membres
//   npm run matching:diagnostic -- email   un membre précis

const target = process.argv[2]?.toLowerCase();

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.databaseUrl) });
  try {
    // Colonnes utiles seulement : le diagnostic tourne aussi sur une base en retard de migrations.
    const profiles = await prisma.memberProfile.findMany({
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        memberType: true,
        isPublic: true,
        tags: { select: { relation: true, tag: { select: { label: true, category: true } } } },
        user: { select: { email: true, isActive: true, role: true } },
      },
    });
    const toCandidate = (p: (typeof profiles)[number]): MatchCandidate => ({
      userId: p.userId,
      memberType: p.memberType,
      skillsOffered: p.tags.filter((t) => t.tag.category === 'SKILL' && t.relation === 'OFFER').map((t) => t.tag.label),
      skillsWanted: p.tags.filter((t) => t.tag.category === 'SKILL' && t.relation === 'NEED').map((t) => t.tag.label),
      sectors: p.tags.filter((t) => t.tag.category === 'SECTOR' && t.relation === 'OFFER').map((t) => t.tag.label),
      sectorsWanted: p.tags.filter((t) => t.tag.category === 'SECTOR' && t.relation === 'NEED').map((t) => t.tag.label),
    });
    // Même réservoir que le calcul réel (lib/matching/job.ts).
    const pool = profiles.filter((p) => p.isPublic && p.user.isActive);
    console.log(`Profils : ${profiles.length} · dans le réservoir du matching (validés et actifs) : ${pool.length} · seuil : ${env.matchingScoreThreshold}\n`);

    for (const p of profiles) {
      if (target && !p.user.email.toLowerCase().includes(target)) continue;
      const me = toCandidate(p);
      const inPool = p.isPublic && p.user.isActive;
      const scores = pool
        .filter((o) => o.userId !== p.userId)
        .map((o) => ({ name: `${o.firstName} ${o.lastName}`, score: scoreMatch(me, toCandidate(o)) }))
        .sort((a, b) => b.score - a.score);
      const above = scores.filter((s) => s.score >= env.matchingScoreThreshold).length;
      console.log(
        `${p.user.email} — ${inPool ? 'dans le réservoir' : 'HORS réservoir (profil non validé ou compte inactif)'} · domaines ${me.sectors.length} · recherchés ${me.sectorsWanted.length} · compétences ${me.skillsOffered.length}/${me.skillsWanted.length} recherchées · au-dessus du seuil : ${above}`,
      );
      if (target) for (const s of scores.slice(0, 10)) console.log(`   ${String(s.score).padStart(3)}  ${s.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
