import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  async (res) => {
    // Artificial delay to show skeletons
    await new Promise((resolve) => setTimeout(resolve, 200));
    return res;
  },
  async (error) => {
    // Artificial delay to show skeletons even on error
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    if (error.response?.status === 401) {
      // Only clear auth and redirect if we actually had a token (not a public endpoint 401)
      const hadToken = !!useAuthStore.getState().token;
      useAuthStore.getState().clearAuth();
      if (hadToken && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
