import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function okPaginated<T>(res: Response, data: T[], meta: PaginationMeta, status = 200) {
  return res.status(status).json({ data, meta });
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentification requise') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = "Accès refusé") {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Ressource introuvable') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static rateLimited(message = 'Trop de requêtes, réessaie plus tard') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }
}
