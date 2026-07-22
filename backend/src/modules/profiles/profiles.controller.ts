import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, okPaginated } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiResponse';
import * as profilesService from './profiles.service';

export const listProfilesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await profilesService.listProfiles(req.query as never, req.user?.id);
  okPaginated(res, data, meta);
});

export const getProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const profile = await profilesService.getProfileById(req.params.id, req.user?.id);
  ok(res, profile);
});

export const getMyProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await profilesService.getMyProfile(req.user.id);
  ok(res, profile);
});

export const updateMyProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await profilesService.updateProfile(req.user.id, req.body);
  ok(res, profile);
});
