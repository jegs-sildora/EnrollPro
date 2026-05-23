import axios from "axios";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
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

function getCurrentAuthOrigin(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const path = window.location.pathname;
  if (path.startsWith("/learner")) {
    return "learner";
  }

  if (path === "/change-password") {
    return new URLSearchParams(window.location.search).get("origin");
  }

  return "staff";
}

api.interceptors.request.use((config) => {
  const timedConfig = config as typeof config & TimedRequestConfig;
  timedConfig.__requestStartedAt = Date.now();
  timedConfig.__shouldDelayResponse = shouldDelayFetchRequest(config.method);

  const currentOrigin = getCurrentAuthOrigin();
  const isLearnerPath = currentOrigin === "learner";
  const hasLearnerSession = !!useLearnerAuthStore.getState().user;

  const isLearnerApi =
    config.url?.startsWith("/learner") ||
    config.url === "/auth/logout-learner" ||
    (config.url === "/auth/change-password" && isLearnerPath && hasLearnerSession);

  if (isLearnerApi) {
    // Learner auth is cookie-session based. Do not attach bearer token.
  }

  const { activeSchoolYearId, viewingSchoolYearId } =
    useSettingsStore.getState();
  const contextSchoolYearId = viewingSchoolYearId ?? activeSchoolYearId;

  if (contextSchoolYearId) {
    config.headers["x-school-year-context-id"] = String(contextSchoolYearId);
  }

  const currentToken = isLearnerApi
    ? (useLearnerAuthStore.getState().user ? "learner-session" : null)
    : (useAuthStore.getState().user ? "staff-session" : null);

  if (currentToken) {
    const { historicalCorrectionToken } = useSettingsStore.getState();
    if (historicalCorrectionToken) {
      config.headers["x-historical-correction-token"] =
        historicalCorrectionToken;
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

    if (status === 401) {
      const isLearnerApi =
        error.config?.url?.startsWith("/learner") ||
        error.config?.url === "/auth/logout-learner";
      const isLearnerPath = getCurrentAuthOrigin() === "learner";

      if (isLearnerApi) {
        const hadLearnerSession = !!useLearnerAuthStore.getState().user;
        if (hadLearnerSession) {
          if (code === "TOKEN_EXPIRED" && !_sessionExpiredHandled) {
            _sessionExpiredHandled = true;
            useLearnerAuthStore.getState().setSessionExpired(true);
            useLearnerAuthStore.getState().clearAuth();

            sileo.error({
              title: "Session Expired",
              description: "Your session has expired. Please sign in again.",
            });

            setTimeout(() => {
              _sessionExpiredHandled = false;
              if (window.location.pathname !== "/learner/login") {
                window.location.replace("/learner/login");
              }
            }, 1500);
          } else {
            useLearnerAuthStore.getState().clearAuth();
            if (window.location.pathname !== "/learner/login") {
              window.location.replace("/learner/login");
            }
          }
        }
      } else {
        // Staff API 401
        const hadStaffSession = !!useAuthStore.getState().user;
        if (hadStaffSession) {
          useAuthStore.getState().clearAuth();
          if (code === "TOKEN_EXPIRED" && !_sessionExpiredHandled) {
            _sessionExpiredHandled = true;
            useAuthStore.getState().setSessionExpired(true);

            // Only show toast and redirect if the user is currently on a staff path
            if (!isLearnerPath) {
              sileo.error({
                title: "Session Expired",
                description: "Your session has expired. Please sign in again.",
              });

              setTimeout(() => {
                _sessionExpiredHandled = false;
                if (window.location.pathname !== "/staff/login") {
                  window.location.replace("/staff/login");
                }
              }, 1500);
            } else {
              _sessionExpiredHandled = false;
            }
          } else {
            if (!isLearnerPath && window.location.pathname !== "/staff/login") {
              window.location.replace("/staff/login");
            }
          }
        }
      }
    }

    if (status === 403 && code === "SY_ARCHIVED_LOCKED") {
      const hadToken =
        useLearnerAuthStore.getState().user || useAuthStore.getState().user;
      if (hadToken && !_historicalReadOnlyHandled) {
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
