import { create } from 'zustand';
import { adminApi, setAdminAccessTokenCookie, clearAdminAccessTokenCookie } from '@/lib/admin-api';
import type { AuthUser } from '@/types';

interface AdminAuthResponse {
  data: { accessToken: string; user: AuthUser };
}

interface AdminAuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// Store dédié à la session /admin — jamais partagé avec useAuthStore (site
// public + espace membre). Un compte peut être connecté comme membre et
// comme admin en même temps dans le même navigateur sans que l'un écrase
// l'autre (cookies et endpoints /api/auth/admin/* distincts).
export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  user: null,
  status: 'idle',

  login: async (email, password) => {
    const res = await adminApi.post<AdminAuthResponse>('/api/auth/admin/login', { email, password });
    setAdminAccessTokenCookie(res.data.accessToken);
    set({ user: res.data.user, status: 'authenticated' });
    return res.data.user;
  },

  logout: async () => {
    await adminApi.post('/api/auth/admin/logout').catch(() => undefined);
    clearAdminAccessTokenCookie();
    set({ user: null, status: 'unauthenticated' });
  },

  hydrate: async () => {
    set({ status: 'loading' });
    try {
      const res = await adminApi.get<{ data: AuthUser }>('/api/auth/me');
      set({ user: res.data, status: 'authenticated' });
    } catch {
      clearAdminAccessTokenCookie();
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
