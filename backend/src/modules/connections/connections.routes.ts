import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  updateSuggestionSchema,
  createConnectionRequestSchema,
  respondConnectionRequestSchema,
} from './connections.schema';
import {
  listSuggestionsHandler,
  updateSuggestionHandler,
  listRequestsHandler,
  createRequestHandler,
  respondRequestHandler,
  deleteRequestHandler,
  deleteExpertRequestHandler,
  refreshMyMatchingHandler,
  runMatchingHandler,
} from './connections.controller';

export const connectionsRouter = Router();

connectionsRouter.get('/suggestions', requireAuth, listSuggestionsHandler);
connectionsRouter.patch(
  '/suggestions/:id',
  requireAuth,
  validate({ body: updateSuggestionSchema }),
  updateSuggestionHandler,
);
connectionsRouter.post(
  '/matching/run',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  runMatchingHandler,
);
connectionsRouter.post('/matching/refresh', requireAuth, refreshMyMatchingHandler);
connectionsRouter.get('/requests', requireAuth, listRequestsHandler);
connectionsRouter.post(
  '/requests',
  requireAuth,
  validate({ body: createConnectionRequestSchema }),
  createRequestHandler,
);
connectionsRouter.patch(
  '/requests/:id',
  requireAuth,
  validate({ body: respondConnectionRequestSchema }),
  respondRequestHandler,
);
connectionsRouter.delete('/requests/:id', requireAuth, deleteRequestHandler);
connectionsRouter.delete('/expert-requests/:id', requireAuth, deleteExpertRequestHandler);
