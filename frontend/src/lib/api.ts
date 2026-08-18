import { getAccessTokenCookie, setAccessTokenCookie, clearAccessTokenCookie } from './auth-cookies';
import { getClientApiUrl } from './api-url';
import type { ApiErrorBody } from '@/types';

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const response = await fetch(`${getClientApiUrl()}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) return false;
  const json = await response.json();
  setAccessTokenCookie(json.data.accessToken);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;
  const accessToken = getAccessTokenCookie();

  const response = await fetch(`${getClientApiUrl()}${path}`, {
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
    const refreshed = await tryRefreshAccessToken().catch(() => false);
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    clearAccessTokenCookie();
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      errorBody?.error.code ?? 'UNKNOWN_ERROR',
      errorBody?.error.message ?? "Une erreur est survenue",
      errorBody?.error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

// Upload multipart (images admin) — hors apiFetch car le body n'est pas du JSON.
export async function apiUpload(file: File, category: string): Promise<{ url: string }> {
  const accessToken = getAccessTokenCookie();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const response = await fetch(`${getClientApiUrl()}/api/uploads`, {
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
