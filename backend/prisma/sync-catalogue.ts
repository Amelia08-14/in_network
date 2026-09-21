import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';
import { syncCatalogue } from './catalogue';

// Aligne le catalogue d'un environnement (ex. le VPS) sur celui du dépôt :
// services, formules, salles de réunion et modèles de devis — SANS rejouer le
// reste du seed (experts, événements, médias, comptes…).
//
//   npm run catalogue:sync -- --dry-run   simulation : affiche le résultat, n'écrit rien
//   npm run catalogue:sync                applique
//
// Rien n'est supprimé : les services / formules / salles qui ne sont plus au
// catalogue sont désactivés (masqués du site), car des devis, abonnements ou
// réservations peuvent encore les référencer.

const SITE_ID = 'site-hydra';
const dryRun = process.argv.includes('--dry-run');

const adapter = new PrismaMariaDb(env.databaseUrl);
const prisma = new PrismaClient({ adapter });

class DryRunRollback extends Error {}

async function snapshot(db: Pick<PrismaClient, 'serviceCatalogItem' | 'membershipPlan' | 'spaceResource' | 'quoteTemplate'>) {
  const [services, plans, spaces, templates] = await Promise.all([
    db.serviceCatalogItem.findMany({ orderBy: { slug: 'asc' }, select: { slug: true, title: true, isActive: true, priceFrom: true } }),
    db.membershipPlan.findMany({ orderBy: { name: 'asc' }, select: { name: true, isActive: true, price: true } }),
    db.spaceResource.findMany({ orderBy: { name: 'asc' }, select: { name: true, isActive: true } }),
    db.quoteTemplate.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
  ]);
  return {
    services: services.map((s) => `${s.isActive ? 'actif  ' : 'MASQUÉ '} ${s.slug} — ${s.title} (${s.priceFrom ? `dès ${Number(s.priceFrom)} DA` : 'sur devis'})`),
    plans: plans.map((p) => `${p.isActive ? 'actif  ' : 'MASQUÉ '} ${p.name} — ${Number(p.price)} DA`),
    spaces: spaces.map((s) => `${s.isActive ? 'actif  ' : 'MASQUÉ '} ${s.name}`),
    templates: templates.map((t) => t.name),
  };
}

function printDiff(label: string, before: string[], after: string[]) {
  const b = new Set(before);
  const a = new Set(after);
  const removed = before.filter((line) => !a.has(line));
  const added = after.filter((line) => !b.has(line));
  console.log(`\n${label} : ${before.length} avant → ${after.length} après`);
  if (!removed.length && !added.length) console.log('  (aucun changement)');
  for (const line of removed) console.log(`  - ${line}`);
  for (const line of added) console.log(`  + ${line}`);
}

async function main() {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID } });
  if (!site) throw new Error(`Site « ${SITE_ID} » introuvable : cette base n'a pas été initialisée.`);

  const before = await snapshot(prisma);
  let after = before;

  try {
    await prisma.$transaction(
      async (tx) => {
        await syncCatalogue(tx, { siteId: site.id, deactivateOthers: true });
        after = await snapshot(tx);
        // Simulation : on annule tout ce qui vient d'être écrit.
        if (dryRun) throw new DryRunRollback();
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }

  console.log(dryRun ? '=== SIMULATION (rien n\'a été écrit) ===' : '=== CATALOGUE SYNCHRONISÉ ===');
  printDiff('Services', before.services, after.services);
  printDiff('Formules', before.plans, after.plans);
  printDiff('Salles', before.spaces, after.spaces);
  printDiff('Modèles de devis', before.templates, after.templates);
  if (dryRun) console.log('\nPour appliquer : npm run catalogue:sync');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
