import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
  LogIn,
  MapPin,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore, type SettingsState } from "@/store/settings.slice";

type GoogleCredentialResponse = {
  credential: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

type AuthResponseUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
};

type AuthResponsePayload = {
  token: string;
  user: AuthResponseUser;
};

type SchoolMetaSettings = SettingsState & {
  schoolAddress?: string | null;
  schoolDivision?: string | null;
  schoolRegion?: string | null;
};

function getAcronym(value: string): string {
  const clean = value.trim();
  if (!clean) {
    return "EP";
  }

  const parts = clean
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }

  return parts
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

export default function Login() {
  const navigate = useNavigate();
  const { token, user, sessionExpired, setAuth, setSessionExpired } =
    useAuthStore();

  const settings = useSettingsStore() as SchoolMetaSettings;
  const schoolName = "EnrollPro";
  const schoolAddress = normalizeOptionalText(settings.schoolAddress);
  const schoolDivision = normalizeOptionalText(settings.schoolDivision);
  const schoolRegion = normalizeOptionalText(settings.schoolRegion);
  const projectTagline =
    "Digital Platform for Optimized Early Registration and Enrollment";
  const projectFullName = `EnrollPro: ${projectTagline}`;
  const jhsScopeLabel = "Junior High School (Grades 7-10)";

  const acronym = useMemo(() => getAcronym(schoolName), [schoolName]);

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [googleUiError, setGoogleUiError] = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);

  const apiBase = import.meta.env.VITE_API_URL?.replace("/api", "") || "";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";

  const fullLogoUrl = useMemo(() => {
    if (!settings.logoUrl) {
      return null;
    }
    if (
      settings.logoUrl.startsWith("http://") ||
      settings.logoUrl.startsWith("https://")
    ) {
      return settings.logoUrl;
    }
    return `${apiBase}${settings.logoUrl}`;
  }, [apiBase, settings.logoUrl]);

  useEffect(() => {
    if (!sessionExpired) {
      return;
    }

    setSessionExpired(false);
    const timeout = window.setTimeout(() => {
      sileo.warning({
        title: "Session Expired",
        description:
          "Your session has expired. Please sign in again to continue.",
      });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [sessionExpired, setSessionExpired]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const completeLogin = useCallback(
    (payload: AuthResponsePayload, source: "password" | "google") => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      setAuth(payload.token, payload.user);
      setError(null);
      setSuccess("Login successful! Redirecting...");

      sileo.success({
        title: "Welcome back",
        description:
          source === "google"
            ? `Signed in with Google as ${payload.user.firstName} ${payload.user.lastName}`
            : `Signed in as ${payload.user.firstName} ${payload.user.lastName}`,
      });

      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 800);
    },
    [navigate, setAuth],
  );

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setGoogleLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await api.post<AuthResponsePayload>("/auth/google", {
          credential,
        });
        completeLogin(response.data, "google");
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          const status = err.response?.status;
          const code = err.response?.data?.code;

          if (status === 403 && code === "DOMAIN_RESTRICTED") {
            setError(
              "This Google account is not authorized for this DepEd portal.",
            );
          } else if (status === 403 && code === "INVITE_REQUIRED") {
            setError(
              "Your Google account is not yet invited. Contact your registrar or admin.",
            );
          } else if (status === 401 && code === "GOOGLE_EMAIL_NOT_VERIFIED") {
            setError("Your Google email must be verified before signing in.");
          } else {
            toastApiError(err as never);
          }
        } else {
          toastApiError(err as never);
        }
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin],
  );

  const renderGoogleButton = useCallback(() => {
    const mountNode = googleButtonRef.current;
    const googleApi = window.google?.accounts?.id;

    if (!mountNode) {
      return;
    }

    if (!googleApi) {
      setGoogleUiError("Google sign-in is temporarily unavailable.");
      return;
    }

    googleApi.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (response.credential) {
          void handleGoogleCredential(response.credential);
        }
      },
      use_fedcm_for_prompt: true,
    });

    mountNode.innerHTML = "";
    const width = Math.max(280, Math.min(420, mountNode.clientWidth || 320));

    googleApi.renderButton(mountNode, {
      type: "standard",
      theme: "outline",
      text: "continue_with",
      shape: "pill",
      size: "large",
      logo_alignment: "left",
      width,
    });

    setGoogleUiError(null);
  }, [googleClientId, handleGoogleCredential]);

  useEffect(() => {
    if (!googleClientId) {
      setGoogleUiError(
        "Google sign-in is not configured for this environment.",
      );
      return;
    }

    const existingScript = document.querySelector(
      "script[data-google-gsi='true']",
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      renderGoogleButton();
    };

    const handleError = () => {
      setGoogleUiError(
        "Unable to load Google sign-in. You can still use email and password.",
      );
    };

    if (existingScript) {
      if (window.google?.accounts?.id) {
        handleLoad();
      } else {
        existingScript.addEventListener("load", handleLoad);
        existingScript.addEventListener("error", handleError);
      }

      return () => {
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
        window.google?.accounts?.id?.cancel();
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "true";
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      window.google?.accounts?.id?.cancel();
    };
  }, [googleClientId, renderGoogleButton]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<AuthResponsePayload>("/auth/login", {
        email: email.trim(),
        password,
      });
      completeLogin(response.data, "password");
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid email or password");
      } else {
        toastApiError(err as never);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      className="h-screen w-full flex overflow-hidden"
      style={{
        background:
          "linear-gradient(to bottom right, #f8fafc, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))",
      }}>
      <style>{`
        @keyframes login-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes login-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }

        @keyframes login-scale-in {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }

        .login-gradient {
          animation: login-gradient-shift 14s ease infinite;
          background-size: 200% 200%;
        }

        .login-float {
          animation: login-float 9s ease-in-out infinite;
        }

        .login-scale-in {
          animation: login-scale-in 220ms ease-out;
        }
      `}</style>

      <div className="hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-primary">
        <div
          className="absolute inset-0 login-gradient"
          style={{
            background:
              "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--primary) / 0.88), hsl(var(--accent) / 0.88))",
          }}
        />

        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl login-float" />
          <div
            className="absolute bottom-32 right-16 w-80 h-80 rounded-full blur-3xl login-float"
            style={{
              backgroundColor: "hsl(var(--accent-foreground) / 0.18)",
              animationDelay: "2s",
            }}
          />
          <div
            className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full blur-2xl login-float"
            style={{
              backgroundColor: "hsl(var(--primary-foreground) / 0.2)",
              animationDelay: "4s",
            }}
          />

          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          />

          <div className="absolute -top-1/2 -right-1/4 w-full h-full bg-[radial-gradient(circle,_rgba(255,255,255,0.08)_0%,_transparent_70%)] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full">
          <div className="flex items-center gap-4 mb-12">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{acronym}</h1>
              <p className="text-white text-sm font-bold max-w-md">
                {projectTagline}
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-12">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              {schoolName}
            </h2>
            <p className="text-white text-sm font-bold">{jhsScopeLabel}</p>
            <div className="flex flex-col gap-1.5 mt-3">
              {schoolAddress && (
                <div className="flex items-center gap-2 text-white text-sm font-bold">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>{schoolAddress}</span>
                </div>
              )}
              {schoolDivision && (
                <div className="flex items-center gap-2 text-white text-sm font-bold">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span>Division of {schoolDivision}</span>
                </div>
              )}
              {schoolRegion && (
                <div className="flex items-center gap-2 text-white text-sm font-bold">
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <span>{schoolRegion}</span>
                </div>
              )}
              {!schoolAddress && !schoolDivision && !schoolRegion && (
                <p className="text-white text-sm font-bold">
                  DepEd Public School Early Registration and Enrollment Portal
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {[
              {
                icon: BookOpen,
                title: "Phase 1 Automation",
                desc: "Early registration intake with dynamic SCP screening",
              },
              {
                icon: BarChart3,
                title: "Phase 2 Validation",
                desc: "BEEF, SF9 checks, and enrollment finalization",
              },
              {
                icon: Shield,
                title: "Priority Sectioning Engine",
                desc: "SCP hard caps with BEC star and heterogeneous sorting",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-white/20 group">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{feature.title}</h3>
                  <p className="text-white text-sm font-semibold">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-12 xl:left-20 flex items-center gap-3 text-white/50 text-sm">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <span>{projectFullName}</span>
        </div>
      </div>

      <div className="relative w-full lg:w-[45%] xl:w-2/5 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background: "hsl(var(--sidebar-background)/0.5)",
            }}
          />

          <svg
            className="absolute inset-0 h-full w-full opacity-[0.08]"
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="login-pixel-grid"
                x="0"
                y="0"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse">
                <rect
                  x="2"
                  y="2"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="42"
                  y="2"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="2"
                  y="42"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="42"
                  y="42"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-pixel-grid)" />
          </svg>

          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[420px]">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg overflow-hidden"
              style={{
                background: fullLogoUrl
                  ? "white"
                  : "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))",
                boxShadow: "0 10px 15px -3px hsl(var(--primary) / 0.4)",
              }}>
              {fullLogoUrl ? (
                <img
                  src={fullLogoUrl}
                  alt={schoolName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <span className="text-xl font-bold text-gray-900">{acronym}</span>
              <p className="text-xs text-gray-500">{schoolName}</p>
            </div>
          </div>

          <Card className="border-0 shadow-2xl shadow-gray-200 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden">
            <CardHeader className="space-y-1 text-center pt-5 pb-0 px-6">
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg overflow-hidden"
                style={{
                  background: fullLogoUrl
                    ? "white"
                    : "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))",
                  boxShadow: "0 10px 15px -3px hsl(var(--primary) / 0.3)",
                  border: fullLogoUrl
                    ? "2px solid hsl(var(--primary) / 0.2)"
                    : "none",
                }}>
                {fullLogoUrl ? (
                  <img
                    src={fullLogoUrl}
                    alt={schoolName}
                    className="w-10 h-10 object-cover"
                  />
                ) : (
                  <Sparkles className="w-5 h-5 text-white" />
                )}
              </div>
              <CardTitle className="text-xl font-bold text-gray-900 pt-2">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm">
                Sign in to continue to{" "}
                <span className="font-semibold text-primary">
                  EnrollPro
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-5 pt-4">
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 flex items-center gap-2.5 login-scale-in">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-sm font-bold text-red-700">
                    {error}
                  </span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 rounded-xl border flex items-center gap-2.5 login-scale-in bg-gradient-to-r from-primary/10 to-accent/10 border-primary/25">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {success}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-gray-800 font-semibold text-sm pl-1">
                    Email
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200">
                        <User className="w-4 h-4 text-gray-500 transition-colors duration-200" />
                      </div>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      className="pl-12 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-gray-800 font-semibold text-sm pl-1">
                    Password
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200">
                        <Lock className="w-4 h-4 text-gray-500 transition-colors duration-200" />
                      </div>
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      className="pl-12 pr-11 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all duration-200"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }>
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary focus:ring-primary/25"
                    />
                    <span className="text-gray-600 group-hover:text-gray-900 transition-colors font-bold text-sm">
                      Remember me
                    </span>
                  </label>
                  <a
                    href="#"
                    className="font-semibold text-primary transition-colors hover:underline underline-offset-4 decoration-2 text-sm">
                    Forgot password?
                  </a>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90">
                  {isLoading ? (
                    <span className="flex items-center gap-3">
                      <Loader2 className="animate-spin h-5 w-5" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <LogIn className="w-5 h-5" />
                      Sign In
                    </span>
                  )}
                </Button>

                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <div
                      className="absolute inset-0 flex items-center"
                      aria-hidden="true">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-[0.22em] font-semibold text-slate-400 bg-white px-3 mx-auto w-fit">
                      Or continue with
                    </div>
                  </div>

                  <div
                    ref={googleButtonRef}
                    className="min-h-[44px] w-full flex items-center justify-center"
                    aria-label="Continue with Google"
                  />

                  {googleLoading && (
                    <div
                      className="text-center text-sm font-bold text-slate-500"
                      role="status"
                      aria-live="polite">
                      Processing Google sign-in...
                    </div>
                  )}

                  {googleUiError && (
                    <div
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800"
                      role="status"
                      aria-live="polite">
                      {googleUiError}
                    </div>
                  )}
                </div>
              </form>

              <p className="text-[10px] text-gray-400 text-center mt-4 leading-relaxed">
                By signing in, you agree to our{" "}
                <a href="#" className="hover:underline text-primary">
                  Terms
                </a>{" "}
                and{" "}
                <a href="#" className="hover:underline text-primary">
                  Privacy Policy
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
