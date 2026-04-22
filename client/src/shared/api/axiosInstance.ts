import axios from "axios";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";

const MIN_FETCH_LOADING_MS = 0;

type TimedRequestConfig = {
  __requestStartedAt?: number;
  __shouldDelayResponse?: boolean;
};

function shouldDelayFetchRequest(method?: string): boolean {
  return (method ?? "get").toLowerCase() === "get";
}

async function applyMinimumFetchDelay(
  config?: TimedRequestConfig,
): Promise<void> {
  if (!config?.__shouldDelayResponse) {
    return;
  }

  const startedAt = config.__requestStartedAt ?? Date.now();
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_FETCH_LOADING_MS - elapsed;

  if (remaining <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, remaining);
  });
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const timedConfig = config as typeof config & TimedRequestConfig;
  timedConfig.__requestStartedAt = Date.now();
  timedConfig.__shouldDelayResponse = shouldDelayFetchRequest(config.method);

  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;

    const { activeSchoolYearId, viewingSchoolYearId } =
      useSettingsStore.getState();
    const contextSchoolYearId = viewingSchoolYearId ?? activeSchoolYearId;

    if (contextSchoolYearId) {
      config.headers["x-school-year-context-id"] = String(contextSchoolYearId);
    }
  }
  return config;
});

// Track whether we've already triggered a session-expired redirect to avoid
// firing multiple toasts when several concurrent requests all get 401.
let _sessionExpiredHandled = false;
let _historicalReadOnlyHandled = false;

api.interceptors.response.use(
  async (res) => {
    await applyMinimumFetchDelay(res.config as TimedRequestConfig);
    return res;
  },
  async (error) => {
    await applyMinimumFetchDelay(error.config as TimedRequestConfig);

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

    if (status === 409 && code === "HISTORICAL_READ_ONLY" && hadToken) {
      if (!_historicalReadOnlyHandled) {
        _historicalReadOnlyHandled = true;

        sileo.error({
          title: "Read-only School Year",
          description:
            "You are viewing a historical school year. Switch back to the active school year to make changes.",
        });

        setTimeout(() => {
          _historicalReadOnlyHandled = false;
        }, 1200);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
