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
//
// Incidents de production (04 → 15/10/2026) : le pool par défaut finissait par
// ne plus ouvrir aucune connexion (« pool timeout … active=0 idle=0 limit=10 »)
// alors que MySQL répondait parfaitement à un client en ligne de commande au
// même instant — seul un redémarrage du process débloquait la situation. On ne
// garde donc plus les valeurs par défaut :
//   • connexions recyclées souvent (idleTimeout court) plutôt que gardées des
//     dizaines de minutes et risquer qu'elles meurent sans que le pool le voie ;
//   • chaque connexion est revalidée avant d'être prêtée (minDelayValidation: 0),
//     une connexion morte est remplacée au lieu d'être servie ;
//   • délais d'ouverture plus larges que les 10 s par défaut, pour qu'une
//     ouverture simplement lente n'échoue pas (c'était exactement le « 10001ms »
//     des erreurs) ;
//   • pool plus petit : le VPS héberge plusieurs projets sur la même instance
//     MySQL, inutile de réserver 10 connexions par application.
const POOL_OPTIONS = {
  connectionLimit: 5,
  // En secondes, et volontairement très en dessous du wait_timeout de MySQL
  // (28800 s en production) : une connexion inactive est relâchée avant que le
  // serveur ne la ferme de son côté.
  idleTimeout: 60,
  // 0 = valider l'état de la connexion à chaque emprunt, sans fenêtre de grâce.
  minDelayValidation: 0,
  // Millisecondes : obtenir une connexion du pool, ouvrir une connexion TCP,
  // et abandonner la création d'une nouvelle connexion.
  acquireTimeout: 30_000,
  connectTimeout: 20_000,
  initializationTimeout: 20_000,
} as const;

// L'adaptateur accepte soit une chaîne de connexion, soit un objet de
// configuration complet : on part de l'URL (DATABASE_URL) et on y ajoute les
// options de pool ci-dessus.
function poolConfig() {
  const url = new URL(env.databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    // Un mot de passe vide (base locale sans mot de passe) doit rester absent :
    // la chaîne vide est refusée là où « pas de mot de passe » est accepté.
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    // `/in_network` → `in_network`
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ...POOL_OPTIONS,
  };
}

const adapter = new PrismaMariaDb(poolConfig());

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: env.isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  global.__prisma = prisma;
}
