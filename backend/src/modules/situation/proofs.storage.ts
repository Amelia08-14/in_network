import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../../utils/apiResponse';

// Justificatifs de paiement : jamais servis en statique. Le dossier vit hors de
// /uploads (public) et chaque fichier est relu par une route authentifiée qui
// vérifie propriétaire ou droits d'admin.
export const PROOFS_DIR = path.join(process.cwd(), 'private-uploads', 'proofs');
fs.mkdirSync(PROOFS_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const uploader = multer({
  storage: multer.diskStorage({
    destination: PROOFS_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? ''}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!EXTENSION_BY_MIME[file.mimetype]) {
      cb(ApiError.badRequest('Formats acceptés : PDF, JPG, PNG ou WebP.') as never);
      return;
    }
    cb(null, true);
  },
});

/** Middleware Express : un seul fichier `file`, erreurs converties en réponses 422 lisibles. */
export const proofUpload: import('express').RequestHandler = (req, res, next) => {
  uploader.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('Le fichier dépasse 10 Mo.'));
    }
    return next(ApiError.badRequest('Envoi du fichier impossible.'));
  });
};

/** Chemin absolu d'un justificatif — refuse toute sortie du dossier privé. */
export function proofAbsolutePath(relativePath: string): string {
  const resolved = path.resolve(PROOFS_DIR, relativePath);
  if (!resolved.startsWith(PROOFS_DIR + path.sep)) throw ApiError.notFound('Fichier introuvable');
  return resolved;
}
