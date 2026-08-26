import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
      // Express 5 : req.query n'a plus de setter (calculé à la volée depuis
      // l'URL) — écrire dessus comme avant (cf. middleware/validate.ts sous
      // Express 4) lève désormais une TypeError à l'exécution. La version
      // validée/coercée par Zod est donc posée ici plutôt que sur req.query.
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
