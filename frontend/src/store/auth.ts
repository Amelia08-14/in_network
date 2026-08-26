import { create } from 'zustand';
import { api, tryRefreshAccessToken } from '@/lib/api';
import { setAccessTokenCookie, clearAccessTokenCookie } from '@/lib/auth-cookies';
import type { AuthUser } from '@/types';

// Rafraîchit le cookie d'access token (courte durée, ~15 min, cf.
// auth-cookies.ts) de façon proactive tant qu'un onglet reste ouvert avec une
// session active — sans ça, il ne se rafraîchissait que de façon réactive
// (après un 401 dans apiFetch), ce qui laissait le cookie expirer entre deux
// appels API et déclenchait des redirections middleware.ts à tort (cf.
// middleware.ts). Un seul minuteur pour toute l'app (le store est un singleton).
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min < 15 min de durée de vie du cookie
let refreshIntervalId: ReturnType<typeof setInterval> | undefined;

function startTokenRefreshLoop() {
  if (refreshIntervalId) return;
  refreshIntervalId = setInterval(() => {
    tryRefreshAccessToken().catch(() => undefined);
  }, REFRESH_INTERVAL_MS);
}

function stopTokenRefreshLoop() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = undefined;
  }
}

interface AuthResponse {
  data: { accessToken: string; user: AuthUser };
}

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    memberType: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  login: async (email, password) => {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, password });
    setAccessTokenCookie(res.data.accessToken);
    set({ user: res.data.user, status: 'authenticated' });
    startTokenRefreshLoop();
  },

  register: async (input) => {
    const res = await api.post<AuthResponse>('/api/auth/register', input);
    setAccessTokenCookie(res.data.accessToken);
    set({ user: res.data.user, status: 'authenticated' });
    startTokenRefreshLoop();
  },

  logout: async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    clearAccessTokenCookie();
    stopTokenRefreshLoop();
    set({ user: null, status: 'unauthenticated' });
  },

  hydrate: async () => {
    set({ status: 'loading' });
    try {
      const res = await api.get<{ data: AuthUser }>('/api/auth/me');
      set({ user: res.data, status: 'authenticated' });
      startTokenRefreshLoop();
    } catch {
      clearAccessTokenCookie();
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
