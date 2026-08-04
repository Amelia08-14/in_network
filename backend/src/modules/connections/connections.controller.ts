import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import * as connectionsService from './connections.service';
import { runMatchingForUser, runMatchingJob } from '../../lib/matching/job';

export const listSuggestionsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const suggestions = await connectionsService.listMySuggestions(req.user.id);
  ok(res, suggestions);
});

export const updateSuggestionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const suggestion = await connectionsService.updateSuggestionStatus(
    req.user.id,
    req.params.id,
    req.body.status,
  );
  ok(res, suggestion);
});

export const listRequestsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const requests = await connectionsService.listMyConnectionRequests(req.user.id);
  ok(res, requests);
});

export const createRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const request = await connectionsService.createConnectionRequest(
    req.user.id,
    req.body.toUserId,
    req.body.message,
  );
  ok(res, request, 201);
});

export const respondRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const request = await connectionsService.respondToConnectionRequest(
    req.user.id,
    req.params.id,
    req.body.status,
  );
  ok(res, request);
});

export const deleteRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await connectionsService.deleteConnectionRequest(req.user.id, req.params.id);
  res.status(204).send();
});

export const deleteExpertRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await connectionsService.deleteExpertConnectionRequest(req.user.id, req.params.id);
  res.status(204).send();
});

// Déclenchement manuel du job de matching — utile en dev/démo pour ne pas
// attendre le cron nocturne (cf. CDC §8.3). Réservé aux admins en production.
export const runMatchingHandler = asyncHandler(async (_req: Request, res: Response) => {
  const result = await runMatchingJob();
  ok(res, result);
});

export const refreshMyMatchingHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await runMatchingForUser(req.user.id);
  ok(res, result);
});
