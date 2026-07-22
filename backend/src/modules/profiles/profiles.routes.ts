import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { attachUserIfPresent, requireAuth } from '../../middleware/auth';
import { listProfilesQuerySchema, updateProfileSchema } from './profiles.schema';
import {
  listProfilesHandler,
  getProfileHandler,
  getMyProfileHandler,
  updateMyProfileHandler,
} from './profiles.controller';

export const profilesRouter = Router();

profilesRouter.get(
  '/',
  attachUserIfPresent,
  validate({ query: listProfilesQuerySchema }),
  listProfilesHandler,
);
profilesRouter.get('/me', requireAuth, getMyProfileHandler);
profilesRouter.put('/me', requireAuth, validate({ body: updateProfileSchema }), updateMyProfileHandler);
profilesRouter.get('/:id', attachUserIfPresent, getProfileHandler);
