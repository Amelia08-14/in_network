import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiRateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import { authRouter } from './modules/auth/auth.routes';
import { profilesRouter } from './modules/profiles/profiles.routes';
import { expertsRouter } from './modules/experts/experts.routes';
import { tagsRouter } from './modules/tags/tags.routes';
import { sitesRouter } from './modules/sites/sites.routes';
import { spacesRouter } from './modules/spaces/spaces.routes';
import { plansRouter } from './modules/plans/plans.routes';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { servicesRouter } from './modules/services/services.routes';
import { eventsRouter } from './modules/events/events.routes';
import { connectionsRouter } from './modules/connections/connections.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { testimonialsRouter } from './modules/testimonials/testimonials.routes';
import { partnersRouter } from './modules/partners/partners.routes';
import { uploadsRouter, UPLOADS_DIR } from './modules/uploads/uploads.routes';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use(express.json());
app.use(cookieParser());
app.use(apiRateLimit);

app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

// Images uploadées (événements, experts, partenaires) — servies en statique,
// avec CORP ouvert pour que le frontend (autre origine en dev) puisse les charger.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(UPLOADS_DIR),
);

app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/experts', expertsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/testimonials', testimonialsRouter);
app.use('/api/partners', partnersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
