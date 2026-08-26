import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { listSpacesQuerySchema, availabilityQuerySchema } from './spaces.schema';
import * as spacesService from './spaces.service';
import { param } from '../../utils/httpParams';

export const spacesRouter = Router();

spacesRouter.get(
  '/',
  validate({ query: listSpacesQuerySchema }),
  asyncHandler(async (req, res) => {
    const { siteId, type } = req.validatedQuery as { siteId?: string; type?: string };
    const spaces = await spacesService.listSpaces(siteId, type);
    ok(res, spaces);
  }),
);

spacesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const space = await spacesService.getSpaceById(param(req, 'id'));
    ok(res, space);
  }),
);

spacesRouter.get(
  '/:id/availability',
  validate({ query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const { date } = req.validatedQuery as { date: string };
    const availability = await spacesService.getAvailability(param(req, 'id'), date);
    ok(res, availability);
  }),
);
