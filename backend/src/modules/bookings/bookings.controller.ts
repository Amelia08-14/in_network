import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';
import * as bookingsService from './bookings.service';

export const listMyBookingsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const bookings = await bookingsService.listMyBookings(req.user.id);
  ok(res, bookings);
});

export const createBookingHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { spaceId, startAt, endAt } = req.body;
  const booking = await bookingsService.createBooking(req.user.id, spaceId, startAt, endAt);
  ok(res, booking, 201);
});

export const cancelBookingHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
  const booking = await bookingsService.cancelBooking(req.user.id, req.params.id, isAdmin);
  ok(res, booking);
});
