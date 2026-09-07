import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiResponse';
import { param } from '../../utils/httpParams';
import * as companiesService from './companies.service';

export const getMyCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  ok(res, await companiesService.getMyCompany(req.user.id));
});

export const updateMyCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  ok(res, await companiesService.updateMyCompany(req.user.id, req.body));
});

export const addMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  ok(res, await companiesService.addMember(req.user.id, req.body), 201);
});

export const resendMemberAccessHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await companiesService.resendMemberAccess(req.user.id, param(req, 'id'));
  ok(res, { sent: true });
});

export const setMemberActiveHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await companiesService.setMemberActive(req.user.id, param(req, 'id'), req.body.isActive);
  ok(res, { updated: true });
});

export const removeMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await companiesService.removeMember(req.user.id, param(req, 'id'));
  ok(res, { removed: true });
});
