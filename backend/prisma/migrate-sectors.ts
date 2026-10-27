import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';

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

export const SECTOR_MAPPING: Record<string, string | null> = {
  'Accompagnement Stratégique & Financier': 'Conseil & stratégie',
  Agro: 'Agroalimentaire',
  Audiovisuel: 'Audiovisuel & cinéma',
  Beauté: 'Beauté & esthétique',
  'Bien-être': 'Bien-être & spa',
  Commecial: 'Commerce de détail',
  'Conseil et accompagnement des entreprises': 'Conseil & stratégie',
  Cosmétiques: 'Cosmétique & hygiène',
  'Création numérique': 'Design & création',
  'développement économique': 'Conseil & stratégie',
  'économie bleue': 'Pêche & aquaculture',
  'économie sociale et solidaire': 'Économie sociale & solidaire',
  'embeeded systems development': 'Objets connectés (secteur)',
  'Foires & Événementiels': 'Événementiel',
  Formation: 'Formation & développement des compétences',
  HBVVJVHIBKHB: null,
  'incubation de startups': 'Incubateurs & accélérateurs',
  industrie: 'Industrie manufacturière',
  'Industrie pharmaceutique': 'Pharmaceutique & parapharmacie',
  Informatique: 'Services numériques (ESN)',
  Innovation: 'Startups & innovation',
  IT: 'Services numériques (ESN)',
  'Marketing et Publicité': 'Marketing & publicité',
  Média: 'Médias & presse',
  Médias: 'Médias & presse',
  'Projets Immobiliers': 'Promotion & développement immobilier',
  'Prospection commerciale et acquisition de clients': 'Marketing & publicité',
  'Services aux entreprises': 'Conseil & stratégie',
  'Services aux entreprises (B2B)': 'Conseil & stratégie',
  'Services Digitaux et Publicitaires': 'Marketing & publicité',
  'Software engineering': 'Édition de logiciels & SaaS',
  technique: 'Autre secteur',
  technologie: 'Tech',
  test: null,
  'test sec 1': null,
  'test sec 2': null,
  'tous les domaines': 'Autre secteur',
  TRANING: 'Formation & développement des compétences',
  xxxxxxxxxxx: null,
};

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
