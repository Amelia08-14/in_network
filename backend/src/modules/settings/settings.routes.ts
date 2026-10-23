import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { env } from '../../config/env';
import { describeSettings, settingsPatchSchema, updateSettings } from './settings.service';

// Paramètres du processus — monté sous /api/admin/settings, réservé aux
// administrateurs (adminPermission refuse la ressource aux comptes bornés).
export const settingsRouter = Router();

settingsRouter.get('/', asyncHandler(async (_req, res) => ok(res, await describeSettings())));
settingsRouter.patch(
  '/',
  validate({ body: settingsPatchSchema }),
  asyncHandler(async (req, res) => {
    await updateSettings(req.body, req.user!.id);
    ok(res, await describeSettings());
  }),
);

// Intégrations : réception des leads des réseaux sociaux (le jeton lui-même
// n'est jamais renvoyé, il vit dans l'environnement du serveur).
settingsRouter.get('/integrations', (_req, res) =>
  ok(res, {
    leadWebhook: { enabled: Boolean(env.leadWebhookSecret), url: `${env.publicApiUrl}/api/webhooks/leads` },
    siteUrl: env.appUrl,
  }),
);
