import {
  getAdminAccessTokenCookie,
  setAdminAccessTokenCookie,
  clearAdminAccessTokenCookie,
} from './admin-auth-cookies';
import { ApiRequestError } from './api';
import type { ApiErrorBody } from '@/types';

export { ApiRequestError };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

// Client API dédié à /admin — même logique que lib/api.ts (retry silencieux
// sur 401 via refresh) mais branché sur le cookie/refresh admin séparés, pour
// ne jamais mélanger une session admin et une session membre dans le même
// navigateur.
async function tryRefreshAdminAccessToken(): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/auth/admin/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) return false;
  const json = await response.json();
  setAdminAccessTokenCookie(json.data.accessToken);
  return true;
}

export async function adminApiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;
  const accessToken = getAdminAccessTokenCookie();

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await tryRefreshAdminAccessToken().catch(() => false);
    if (refreshed) {
      return adminApiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    clearAdminAccessTokenCookie();
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      errorBody?.error.code ?? 'UNKNOWN_ERROR',
      errorBody?.error.message ?? 'Une erreur est survenue',
      errorBody?.error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const adminApi = {
  get: <T>(path: string, options?: RequestOptions) => adminApiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    adminApiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    adminApiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    adminApiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => adminApiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export async function adminApiUpload(file: File, category: string): Promise<{ url: string }> {
  const accessToken = getAdminAccessTokenCookie();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const response = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      errorBody?.error.code ?? 'UNKNOWN_ERROR',
      errorBody?.error.message ?? "Échec de l'envoi du fichier",
    );
  }
  const json = await response.json();
  return json.data as { url: string };
}

export { setAdminAccessTokenCookie, clearAdminAccessTokenCookie };

// Alias courts — permettent aux pages copiées depuis l'ancienne app admin de
// ne changer que le chemin d'import (`@/lib/api` → `@/lib/admin-api`), sans
// toucher aux appels `api.get(...)` / `apiUpload(...)` eux-mêmes.
export const api = adminApi;
export const apiUpload = adminApiUpload;
