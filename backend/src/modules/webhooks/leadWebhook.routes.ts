import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError, ok } from '../../utils/apiResponse';
import { createLeadFromAdForm } from '../crm/leadIntake.service';

// Réception des leads des formulaires publicitaires des réseaux sociaux
// (Facebook / Instagram Lead Ads, LinkedIn Lead Gen…) — POST /api/webhooks/leads.
// Pensé pour Make ou Zapier : le scénario reçoit le lead du réseau et le
// renvoie ici. Accès par jeton partagé (LEAD_WEBHOOK_SECRET), dans l'en-tête
// X-Webhook-Token (ou Authorization: Bearer). Les noms de champs courants des
// réseaux sont acceptés tels quels (full_name, phone_number, campaign_name…) ;
// les autres réponses du formulaire sont reprises dans les notes du lead.
// WhatsApp reste saisi à la main (décision du 23/10/2026).

export const leadWebhookRouter = Router();

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes, réessayez dans une minute.' } },
});

function requireToken(req: Request, _res: Response, next: NextFunction) {
  if (!env.leadWebhookSecret) return next(new ApiError(503, 'WEBHOOK_DISABLED', 'La réception des leads des réseaux n’est pas configurée (LEAD_WEBHOOK_SECRET).'));
  const header = req.header('x-webhook-token') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = Buffer.from(env.leadWebhookSecret);
  const given = Buffer.from(header);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return next(ApiError.unauthorized('Jeton invalide.'));
  next();
}

const text = (max: number) => z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined), z.string().max(max).optional());

// Noms acceptés pour chaque information (formats Meta, LinkedIn, Make, Zapier).
const ALIASES = {
  platform: ['platform', 'source', 'network', 'reseau'],
  fullName: ['name', 'full_name', 'fullName', 'nom_complet', 'contactName'],
  firstName: ['first_name', 'firstName', 'prenom'],
  lastName: ['last_name', 'lastName', 'nom'],
  email: ['email', 'email_address', 'emailAddress', 'work_email'],
  phone: ['phone', 'phone_number', 'phoneNumber', 'telephone', 'mobile'],
  company: ['company', 'company_name', 'companyName', 'entreprise', 'organization'],
  message: ['message', 'need', 'besoin', 'comments', 'notes'],
  campaign: ['campaign', 'campaign_name', 'campaignName', 'utm_campaign'],
  form: ['form', 'form_name', 'formName'],
  ad: ['ad', 'ad_name', 'adName'],
} as const;
const KNOWN = new Set<string>([...Object.values(ALIASES).flat(), 'created_time', 'id', 'lead_id', 'leadgen_id', 'form_id', 'ad_id', 'page_id', 'campaign_id', 'adset_id', 'adset_name', 'is_organic']);

function pick(body: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

const leadSchema = z
  .object({
    platform: text(60),
    contactName: text(190),
    email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().email('Adresse e-mail invalide').max(190).optional()),
    phone: text(60),
    companyName: text(190),
    message: text(4000),
    campaign: text(190),
    form: text(190),
    ad: text(190),
  })
  .refine((v) => v.email || v.phone, { message: 'Le lead doit comporter un e-mail ou un téléphone.' });

leadWebhookRouter.post(
  '/',
  webhookRateLimit,
  requireToken,
  asyncHandler(async (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const first = pick(body, ALIASES.firstName);
    const last = pick(body, ALIASES.lastName);
    const parsed = leadSchema.safeParse({
      platform: pick(body, ALIASES.platform),
      contactName: pick(body, ALIASES.fullName) ?? ([first, last].filter(Boolean).join(' ') || undefined),
      email: pick(body, ALIASES.email),
      phone: pick(body, ALIASES.phone),
      companyName: pick(body, ALIASES.company),
      message: pick(body, ALIASES.message),
      campaign: pick(body, ALIASES.campaign),
      form: pick(body, ALIASES.form),
      ad: pick(body, ALIASES.ad),
    });
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Lead invalide');

    // Réponses du formulaire qui ne correspondent à aucun champ connu.
    const answers = Object.fromEntries(
      Object.entries(body)
        .filter(([key, value]) => !KNOWN.has(key) && value !== null && value !== undefined && typeof value !== 'object' && String(value).trim() !== '')
        .slice(0, 30)
        .map(([key, value]) => [key.replace(/_/g, ' ').slice(0, 60), String(value).trim().slice(0, 500)]),
    );

    const data = parsed.data;
    const { lead, duplicate } = await createLeadFromAdForm({
      platform: data.platform ?? 'réseau social',
      contactName: data.contactName ?? data.email ?? data.phone ?? 'Contact des réseaux',
      email: data.email ?? null,
      phone: data.phone ?? null,
      companyName: data.companyName ?? null,
      message: data.message ?? null,
      campaign: data.campaign ?? null,
      form: data.form ?? null,
      ad: data.ad ?? null,
      answers,
    });
    ok(res, { leadId: lead.id, reference: lead.reference, duplicate }, duplicate ? 200 : 201);
  }),
);
