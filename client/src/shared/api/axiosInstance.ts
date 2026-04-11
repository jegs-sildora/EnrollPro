import axios from "axios";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track whether we've already triggered a session-expired redirect to avoid
// firing multiple toasts when several concurrent requests all get 401.
let _sessionExpiredHandled = false;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const code: string | undefined = error.response?.data?.code;
    const hadToken = !!useAuthStore.getState().token;

    if (status === 401 && hadToken) {
      if (code === "TOKEN_EXPIRED") {
        if (!_sessionExpiredHandled) {
          _sessionExpiredHandled = true;

          // Mark session as expired so Login page can show a contextual message
          useAuthStore.getState().setSessionExpired(true);
          useAuthStore.getState().clearAuth();

          sileo.error({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
          });

          // Delay redirect slightly so the toast renders before navigation
          setTimeout(() => {
            _sessionExpiredHandled = false;
            if (!window.location.pathname.startsWith("/login")) {
              window.location.replace("/login");
            }
          }, 1500);
        }
      } else {
        // ACCOUNT_INACTIVE, INVALID_TOKEN, or generic 401
        useAuthStore.getState().clearAuth();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
