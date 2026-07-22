import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// Valide et remplace req.body/query/params par la version parsée par Zod
// (coercitions incluses), pour que les controllers reçoivent des données
// déjà typées et sûres.
export function validate({ body, query, params }: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (body) req.body = body.parse(req.body);
    if (query) req.query = query.parse(req.query) as typeof req.query;
    if (params) req.params = params.parse(req.params) as typeof req.params;
    next();
  };
}
