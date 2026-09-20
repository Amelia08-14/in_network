import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export type DocumentPrefix = 'LD' | 'DV' | 'FA';

// Numérotation séquentielle par préfixe et par année : LD-2026-0001,
// DV-2026-0001, FA-2026-0001. L'incrément est atomique en base ; pour une
// facture, l'appel se fait à l'émission (cf. invoices.service.ts) afin que la
// suite reste continue même si un brouillon est supprimé.
export async function nextNumber(prefix: DocumentPrefix, db: Db = prisma): Promise<string> {
  const key = `${prefix}-${new Date().getFullYear()}`;
  const row = await db.documentSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(row.value).padStart(4, '0')}`;
}
