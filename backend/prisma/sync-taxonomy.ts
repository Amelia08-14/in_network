import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';
import { syncTaxonomy } from './taxonomy';

// Charge (ou met à jour) la liste des compétences et des domaines d'activité
// d'un environnement, SANS rejouer le reste du seed.
//
//   npm run taxonomy:sync
//
// Rien n'est supprimé ni renommé : les étiquettes saisies librement par les
// membres restent telles quelles ; les libellés du référentiel sont créés ou
// rattachés à leur famille.

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.databaseUrl) });

syncTaxonomy(prisma)
  .then(({ skills, sectors }) => console.log(`Taxonomie synchronisée : ${skills} compétences, ${sectors} domaines d'activité.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
