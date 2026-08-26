import type { Request } from 'express';

// Express 5 : req.params[x] est typé `string | string[] | undefined` (les
// routes à segments répétés, ex. "/:id+", peuvent produire un tableau) —
// aucune route de cette app n'utilise ce genre de pattern, un paramètre
// nommé est toujours une valeur simple au runtime ici. Ce helper confirme
// ça au typeur plutôt que de forcer un cast à chaque site d'appel.
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : (value as string);
}
