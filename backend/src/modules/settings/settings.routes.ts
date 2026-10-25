import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { env } from '../../config/env';
import { ApiError } from '../../utils/apiResponse';
import { describeSettings, settingsPatchSchema, updateSettings } from './settings.service';
import { describeOptions, getOptions, optionsPatchSchema, updateOptions } from './options.service';

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

// Listes de choix et rubriques du menu : lues par toute l'équipe, modifiées par
// le super administrateur seulement (demande client 25/10/2026).
settingsRouter.get('/options', asyncHandler(async (_req, res) => ok(res, await describeOptions())));
settingsRouter.patch(
  '/options',
  (req, _res, next) => (req.user?.role === 'SUPER_ADMIN' ? next() : next(ApiError.forbidden('Réservé au super administrateur.'))),
  validate({ body: optionsPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await updateOptions(req.body, req.user!.id))),
);

// Lecture publique (site et dashboard) : listes de choix et rubriques masquées.
export const optionsRouter = Router();
optionsRouter.get('/', asyncHandler(async (_req, res) => ok(res, await getOptions())));
