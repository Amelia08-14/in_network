import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import { createSubscriptionSchema } from './subscriptions.schema';
import * as subscriptionsService from './subscriptions.service';
import { param } from '../../utils/httpParams';

export const subscriptionsRouter = Router();

subscriptionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const subscriptions = await subscriptionsService.listMySubscriptions(req.user.id);
    ok(res, subscriptions);
  }),
);

subscriptionsRouter.post(
  '/',
  requireAuth,
  validate({ body: createSubscriptionSchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const subscription = await subscriptionsService.createSubscription(
      req.user.id,
      req.body.planId,
      req.body.method,
    );
    ok(res, subscription, 201);
  }),
);

subscriptionsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const subscription = await subscriptionsService.getSubscriptionById(req.user.id, param(req, 'id'));
    ok(res, subscription);
  }),
);
