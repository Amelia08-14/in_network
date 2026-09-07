import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireCompleteProfile } from '../../middleware/requireCompleteProfile';
import { validate } from '../../middleware/validate';
import { createBookingSchema, updateBookingSchema } from './bookings.schema';
import { listMyBookingsHandler, createBookingHandler, cancelBookingHandler } from './bookings.controller';

export const bookingsRouter = Router();

bookingsRouter.get('/', requireAuth, listMyBookingsHandler);
bookingsRouter.post('/', requireAuth, requireCompleteProfile, validate({ body: createBookingSchema }), createBookingHandler);
bookingsRouter.put(
  '/:id',
  requireAuth,
  validate({ body: updateBookingSchema }),
  cancelBookingHandler,
);
