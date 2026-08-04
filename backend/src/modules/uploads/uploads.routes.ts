import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, ApiError } from '../../utils/apiResponse';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const ALLOWED_CATEGORIES = new Set(['events', 'experts', 'partners', 'sites']);
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB — assez pour de courts clips récap d'événements
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      cb(new Error('Seuls les fichiers image ou vidéo (mp4/mov/webm) sont acceptés'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

// Upload admin (événements, experts, partenaires) — images converties en
// webp via sharp ; vidéos (clips récap d'événements) sauvegardées telles
// quelles, pas de pipeline de transcodage pour ce MVP. Stockage disque local
// (cohérent avec le déploiement Nginx/VPS, pas de S3 configuré).
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

    if (isVideo) {
      fs.writeFileSync(destPath, req.file.buffer);
    } else {
      await sharp(req.file.buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(destPath);
    }

    const url = `${req.protocol}://${req.get('host')}/uploads/${category}/${filename}`;
    ok(res, { url }, 201);
  }),
);
