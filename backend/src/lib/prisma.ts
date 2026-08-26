import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Migration Prisma 7 (§0 brief) : le moteur Rust est retiré, un driver
// adapter devient obligatoire pour toute connexion — @prisma/adapter-mariadb
// (protocole MariaDB, compatible MySQL) plutôt que se connecter directement
// depuis schema.prisma comme avant.
const adapter = new PrismaMariaDb(env.databaseUrl);

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: env.isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  global.__prisma = prisma;
}
