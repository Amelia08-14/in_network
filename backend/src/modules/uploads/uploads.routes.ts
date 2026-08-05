import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const TMP_DIR = path.join(os.tmpdir(), 'in-network-uploads');
fs.mkdirSync(TMP_DIR, { recursive: true });

const ALLOWED_CATEGORIES = new Set(['events', 'experts', 'partners', 'sites', 'testimonials']);
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

// Stockage disque (pas memoryStorage) — une vidéo de plusieurs dizaines de MB
// entièrement bufferisée en RAM peut à elle seule dépasser la limite
// max_memory_restart de PM2 (300M, cf. backend/ecosystem.config.js) et faire
// planter le process en plein upload. multer écrit directement sur disque au
// fil de la requête ; seul sharp (traitement des images) charge le fichier
// en mémoire, et seulement pour des images (bornées à 1600px après resize).
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}-${file.originalname}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — assez pour des clips vidéo réels (galerie, témoignages)
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      cb(new Error('Seuls les fichiers image ou vidéo (mp4/mov/webm) sont acceptés'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

// Upload admin (événements, experts, partenaires, sites, témoignages) — images
// converties en webp via sharp ; vidéos sauvegardées telles quelles, pas de
// pipeline de transcodage pour ce MVP. Stockage disque local (cohérent avec
// le déploiement Nginx/VPS, pas de S3 configuré).
uploadsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Aucun fichier reçu');

    const category = typeof req.body.category === 'string' && ALLOWED_CATEGORIES.has(req.body.category)
      ? req.body.category
      : 'misc';

    const dir = path.join(UPLOADS_DIR, category);
    fs.mkdirSync(dir, { recursive: true });

    const isVideo = req.file.mimetype.startsWith('video/');
    const extension = isVideo ? (req.file.mimetype === 'video/webm' ? 'webm' : 'mp4') : 'webp';
    const filename = `${crypto.randomUUID()}.${extension}`;
    const destPath = path.join(dir, filename);

    try {
      if (isVideo) {
        fs.renameSync(req.file.path, destPath);
      } else {
        await sharp(req.file.path, { failOn: 'none' })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(destPath);
        fs.unlinkSync(req.file.path);
      }
    } finally {
      fs.rm(req.file.path, { force: true }, () => {}); // no-op si déjà déplacé/supprimé
    }

    const url = `${req.protocol}://${req.get('host')}/uploads/${category}/${filename}`;
    ok(res, { url }, 201);
  }),
);
