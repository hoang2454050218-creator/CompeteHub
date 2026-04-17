import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
              {},
              { withCredentials: true }
            )
            .then((res) => {
              const { accessToken } = res.data.data;
              useAuthStore.getState().setAccessToken(accessToken);
              scheduleTokenRefresh(accessToken);
              return accessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const accessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTokenRefresh(token: string) {
  if (refreshTimer) clearTimeout(refreshTimer);
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();
    const refreshAt = expiresIn - 60_000;
    if (refreshAt > 0) {
      refreshTimer = setTimeout(async () => {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          const { accessToken } = res.data.data;
          useAuthStore.getState().setAccessToken(accessToken);
          scheduleTokenRefresh(accessToken);
        } catch {
          // 401 interceptor handles fallback
        }
      }, refreshAt);
    }
  } catch {
    // non-JWT token, skip
  }
}

export default api;
