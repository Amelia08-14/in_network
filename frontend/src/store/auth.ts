import { create } from 'zustand';
import { api } from '@/lib/api';
import { setAccessTokenCookie, clearAccessTokenCookie } from '@/lib/auth-cookies';
import type { AuthUser } from '@/types';

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
  },

  register: async (input) => {
    const res = await api.post<AuthResponse>('/api/auth/register', input);
    setAccessTokenCookie(res.data.accessToken);
    set({ user: res.data.user, status: 'authenticated' });
  },

  logout: async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    clearAccessTokenCookie();
    set({ user: null, status: 'unauthenticated' });
  },

  hydrate: async () => {
    set({ status: 'loading' });
    try {
      const res = await api.get<{ data: AuthUser }>('/api/auth/me');
      set({ user: res.data, status: 'authenticated' });
    } catch {
      clearAccessTokenCookie();
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
