import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import {
  AlertCircle,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  LogIn,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";

interface PublicConfig {
  schoolName: string;
  schoolAcronym: string;
  logoUrl: string | null;
  depedSchoolId: string | null;
  region: string | null;
  division: string | null;
  globalDefaultPassword: string | null;
}

interface LearnerResponse {
  id: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
}

interface AuthResponse {
  token: string;
  requiresPasswordReset: boolean;
  schoolName: string;
  schoolAcronym: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  learner: LearnerResponse;
}

const DEFAULT_CONFIG: PublicConfig = {
  schoolName: "EnrollPro",
  schoolAcronym: "EP",
  logoUrl: null,
  depedSchoolId: null,
  region: null,
  division: null,
  globalDefaultPassword: "DepEd2026!",
};

export default function LearnerLogin() {
  const navigate = useNavigate();
  const { user, sessionExpired, setAuth, setRequiresPasswordReset, setSessionExpired } =
    useLearnerAuthStore();

  const [publicConfig, setPublicConfig] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const savedLrn = localStorage.getItem("rememberedLearnerLrn");
    if (savedLrn) {
      setLrn(savedLrn);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get<PublicConfig>("/system/public-config", { timeout: 10000 })
      .then((res) => {
        if (!cancelled) {
          setPublicConfig(res.data);
          setConfigLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const apiBase = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

  const fullLogoUrl = useMemo(() => {
    if (!publicConfig.logoUrl) return null;
    if (
      publicConfig.logoUrl.startsWith("http://") ||
      publicConfig.logoUrl.startsWith("https://")
    ) {
      return publicConfig.logoUrl;
    }
    return `${apiBase}${publicConfig.logoUrl}`;
  }, [apiBase, publicConfig.logoUrl]);

  const handleLrnChange = useCallback((value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const truncated = digitsOnly.slice(0, 12);
    setLrn(truncated);
    setError(null);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setError(null);
  }, []);

  useEffect(() => {
    if (!sessionExpired) return;
    setSessionExpired(false);
    const timeout = window.setTimeout(() => {
      sileo.warning({
        title: "Session Expired",
        description: "Your session has expired. Please sign in again to continue.",
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
    (payload: AuthResponse) => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      setAuth(
        {
          id: payload.learner.id,
          lrn: payload.learner.lrn,
          firstName: payload.learner.firstName,
          lastName: payload.learner.lastName,
          middleName: payload.learner.middleName,
          schoolName: payload.schoolName,
          schoolAcronym: payload.schoolAcronym,
          gradeLevelName: payload.gradeLevelName,
          sectionName: payload.sectionName,
        },
        payload.token,
      );

      if (rememberMe) {
        localStorage.setItem("rememberedLearnerLrn", payload.learner.lrn);
      } else {
        localStorage.removeItem("rememberedLearnerLrn");
      }

      setError(null);
      setSuccess("Login successful! Redirecting...");

      sileo.success({
        title: "Welcome",
        description: `Signed in as ${payload.learner.firstName} ${payload.learner.lastName}`,
      });

      if (payload.requiresPasswordReset) {
        setRequiresPasswordReset(true);
        setSuccess("First-time login detected. Setting up your password...");
        redirectTimeoutRef.current = window.setTimeout(() => {
          navigate("/learner/change-password", { state: { isForcedReset: true }, replace: true });
        }, 800);
        return;
      }

      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate("/learner/portal", { replace: true });
      }, 800);
    },
    [navigate, setAuth, rememberMe],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (lrn.length !== 12) {
      setError("Invalid LRN: Must be exactly 12 digits.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post<AuthResponse>("/learner/auth", {
        lrn,
        password,
      });
      completeLogin(response.data);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError("Invalid LRN or password.");
        } else {
          toastApiError(err);
        }
      } else {
        toastApiError(err as never);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return <Navigate to="/learner/portal" replace />;
  }

  if (!configLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="learner-login-pixel-grid"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#learner-login-pixel-grid)" />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
      >
        <style>{`
        @keyframes learner-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes learner-scale-in {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
        .learner-float {
          animation: learner-float 8s ease-in-out infinite;
        }
        .learner-scale-in {
          animation: learner-scale-in 220ms ease-out;
        }
      `}</style>

        <div className="w-full max-w-md">
          <Card className="bg-card shadow-xl rounded-2xl w-full border">
            <CardContent className="px-6 py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  {fullLogoUrl ? (
                    <img
                      src={fullLogoUrl}
                      alt={publicConfig.schoolName}
                      className="h-16 w-16 object-contain rounded-xl shadow-lg bg-card p-1"
                    />
                  ) : (
                    <div
                      className="h-16 w-16 rounded-xl flex items-center justify-center shadow-lg learner-float"
                      style={{
                        background:
                          "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))",
                      }}
                    >
                      <GraduationCap className="h-8 w-8 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <h1 className="text-xl font-bold text-foreground">
                  {publicConfig.schoolAcronym} Learner Portal
                </h1>
              </div>
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2.5 learner-scale-in">
                  <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  </div>
                  <span className="text-sm font-bold text-destructive">{error}</span>
                </div>
              )}

              {success && (
                <div
                  className="mb-4 p-3 rounded-xl border flex items-center gap-2.5 learner-scale-in"
                  style={{
                    background: "linear-gradient(to right, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.1))",
                    borderColor: "hsl(var(--primary) / 0.25)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-primary">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="lrn"
                    className="text-foreground font-bold text-sm pl-1"
                  >
                    Learner Reference Number (LRN)
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-8 h-8 rounded-lg bg-muted group-focus-within:bg-muted/80 flex items-center justify-center transition-colors duration-200">
                        <GraduationCap className="w-4 h-4 text-muted-foreground transition-colors duration-200" />
                      </div>
                    </div>
                    <Input
                      id="lrn"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter your 12-digit LRN"
                      value={lrn}
                      onChange={(e) => handleLrnChange(e.target.value)}
                      className="pl-12 h-11 bg-muted/30 border-border hover:border-border/80 focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-muted-foreground text-foreground font-bold focus-visible:ring-offset-0"
                      autoComplete="username"
                      maxLength={12}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-foreground font-bold text-sm pl-1"
                  >
                    Password
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-8 h-8 rounded-lg bg-muted group-focus-within:bg-muted/80 flex items-center justify-center transition-colors duration-200">
                        <Lock className="w-4 h-4 text-muted-foreground transition-colors duration-200" />
                      </div>
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className="pl-12 pr-11 h-11 bg-muted/30 border-border hover:border-border/80 focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-muted-foreground text-foreground font-bold focus-visible:ring-offset-0"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-all duration-200"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
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
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked === true)
                      }
                      className="rounded-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors font-bold text-sm">
                      Remember me
                    </span>
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-primary-foreground"
                >
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
              </form>

              <p className="text-center text-xs text-muted-foreground/70 mt-6 leading-relaxed">
                Forgot password? Contact your Class Adviser for a reset.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}