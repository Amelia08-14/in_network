import { serverGet } from './server-api';
import type { GalleryImageItem } from '@/types';

interface SiteSummary {
  id: string;
  name: string;
}

// Un seul lieu actif en V1 (Hydra, Alger) — cf. sites.routes.ts.
export async function getPrimarySiteGallery(): Promise<GalleryImageItem[]> {
  const sites = await serverGet<SiteSummary[]>('/api/sites', 3600, []);
  const site = sites[0];
  if (!site) return [];
  return serverGet<GalleryImageItem[]>(`/api/sites/${site.id}/gallery`, 900, []);
}
