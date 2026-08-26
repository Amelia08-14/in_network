import 'dotenv/config';
import { defineConfig } from '@prisma/config';

// Migration Prisma 7 (§0 brief) : l'URL de connexion utilisée par la CLI
// (migrate, studio, introspection...) ne vit plus dans schema.prisma — elle
// est déclarée ici. La connexion réelle utilisée à l'exécution par
// PrismaClient passe elle par le driver adapter (cf. src/lib/prisma.ts),
// configuré séparément à partir de la même variable d'environnement.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
