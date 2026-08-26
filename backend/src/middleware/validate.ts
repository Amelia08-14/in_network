import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// Valide et remplace req.body/params par la version parsée par Zod
// (coercitions incluses), pour que les controllers reçoivent des données
// déjà typées et sûres. req.query est traité à part : Express 5 en a fait
// un getter sans setter (calculé à la volée depuis l'URL), une affectation
// directe lève désormais une TypeError à l'exécution — la version validée
// est donc posée sur req.validatedQuery (cf. types/express.d.ts) que les
// controllers lisent à la place de req.query.
export function validate({ body, query, params }: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (body) req.body = body.parse(req.body);
    if (query) req.validatedQuery = query.parse(req.query);
    if (params) req.params = params.parse(req.params) as typeof req.params;
    next();
  };
}
