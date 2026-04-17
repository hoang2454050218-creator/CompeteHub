import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isRehydrating: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  rehydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isRehydrating: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      setUser: (user) =>
        set({ user }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      rehydrate: async () => {
        const state = get();
        if (state.user && !state.accessToken) {
          set({ isRehydrating: true });
          try {
            const { default: axios } = await import('axios');
            const res = await axios.post(
              `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
              {},
              { withCredentials: true }
            );
            const { accessToken } = res.data.data;
            set({ accessToken, isAuthenticated: true, isRehydrating: false });
            const { scheduleTokenRefresh } = await import('../services/api');
            scheduleTokenRefresh(accessToken);
          } catch {
            set({ user: null, accessToken: null, isAuthenticated: false, isRehydrating: false });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user ? { id: state.user.id, name: state.user.name, role: state.user.role, avatarUrl: state.user.avatarUrl } : null,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
