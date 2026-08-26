import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiResponse';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route inconnue: ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    const details = err.flatten();
    const firstMessage = err.issues[0]?.message;
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstMessage || 'Données invalides',
        details,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('Prisma request error', { code: err.code, path: req.originalUrl });
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Une donnée identique existe déjà' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'La donnée à modifier n’existe plus' },
      });
    }
    if (err.code === 'P2000') {
      return res.status(422).json({
        error: { code: 'VALUE_TOO_LONG', message: 'Une valeur saisie dépasse la longueur autorisée' },
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: { code: 'RELATED_DATA_CONFLICT', message: 'Cette opération est bloquée par une donnée associée' },
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' },
  });
}
