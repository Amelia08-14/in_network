import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';
import { SECTOR_MAPPING } from '../src/lib/matching/sectorAliases';

// Domaines d'activité saisis librement → libellés du référentiel
// (prisma/taxonomy.ts). Table PROPOSÉE (audit 27/10/2026, tâche 4.3), à
// valider par IN NETWORK avant application — le détail et les cas à confirmer
// sont dans docs/annuaire-secteurs-correspondance.md.
//
//   npm run sectors:migrate              simulation : affiche ce qui changerait, n'écrit rien
//   npm run sectors:migrate -- --apply   applique
//
// Pour chaque saisie libre : les profils qui la portent reçoivent le libellé
// du référentiel (sans doublon), puis l'étiquette libre est retirée. `null` =
// saisie de test ou vide de sens, simplement retirée des profils.

// Table : src/lib/matching/sectorAliases.ts (partagée avec le matching).


const apply = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.databaseUrl) });
  try {
    const targets = [...new Set(Object.values(SECTOR_MAPPING).filter((v): v is string => Boolean(v)))];
    const known = await prisma.tag.findMany({ where: { label: { in: targets }, category: 'SECTOR', group: { not: null } }, select: { id: true, label: true } });
    const missing = targets.filter((label) => !known.some((t) => t.label === label));
    if (missing.length) throw new Error(`Libellés absents du référentiel (lancer npm run taxonomy:sync) : ${missing.join(', ')}`);
    const targetId = new Map(known.map((t) => [t.label, t.id]));

    let moved = 0;
    await prisma.$transaction(async (tx) => {
      for (const [from, to] of Object.entries(SECTOR_MAPPING)) {
        const free = await tx.tag.findFirst({ where: { label: from, category: 'SECTOR', group: null }, include: { profileTags: true } });
        if (!free) continue;
        console.log(`${from} → ${to ?? '(retirée)'} : ${free.profileTags.length} profil(s)`);
        moved += free.profileTags.length;
        if (!apply) continue;
        if (to) {
          await tx.profileTag.createMany({
            data: free.profileTags.map((pt) => ({ profileId: pt.profileId, tagId: targetId.get(to)!, relation: pt.relation })),
            skipDuplicates: true,
          });
        }
        await tx.profileTag.deleteMany({ where: { tagId: free.id } });
        await tx.tag.delete({ where: { id: free.id } });
      }
    }, { timeout: 60_000 });
    console.log(apply ? `\n=== APPLIQUÉ : ${moved} rattachement(s) traités ===` : `\n=== SIMULATION : ${moved} rattachement(s) seraient traités — rien n'a été écrit ===\nPour appliquer : npm run sectors:migrate -- --apply`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
