import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Recycle,
  Sparkles,
  User,
  UserCheck,
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
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore, type SettingsState } from "@/store/settings.slice";

type AuthResponseUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
  accountName: string | null;
  roles: string[];
  mustChangePassword?: boolean;
};

type AuthResponsePayload = {
  user: AuthResponseUser;
};

type SchoolMetaSettings = SettingsState & {
  schoolAddress?: string | null;
  schoolDivision?: string | null;
  schoolRegion?: string | null;
};





function getAcronym(value: string | undefined | null): string {
  if (!value) return "EnrollPro";
  const clean = value.trim();
  if (!clean) return "EnrollPro";

  if (clean === "Hinigaran National High School") {
    return "HNHS";
  }

  if (clean === "Enriqueta Montilla de Esteban Memorial High School") {
    return "EMEMHS";
  }

  const stopWords = new Set(["de", "del", "dela", "of", "the", "and", "ng", "mga", "at"]);
  const parts = clean
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }

  return parts
    .filter((part) => !stopWords.has(part.toLowerCase()))
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const LoginDecorativeSidebar = memo(function LoginDecorativeSidebar({
  schoolName,
  acronym,
}: {
  schoolName: string;
  acronym: string;
}) {
  return (
    <div className="hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-primary shrink-0">
      <div
        className="absolute inset-0 login-gradient"
        style={{
          background:
            "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--primary) / 0.88), hsl(var(--accent) / 0.88))",
        }}
      />

      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-muted/10 blur-3xl login-float" />
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
        <div className="space-y-6 mb-12">
          {/* Sovereign Header */}
          <div>
            <span className="text-xl font-extrabold tracking-widest text-primary-foreground uppercase">{schoolName}</span>
            <p className="text-white/70 text-base mt-1">
              Integrated Administrative, Academic & Support Systems
            </p>
          </div>

          {/* Main System Title */}
          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight text-white mb-2">
              {acronym}
            </h1>
            <p className="text-white/90 text-lg ">
              Junior High School Information Management Portal
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {[
            {
              icon: UserCheck,
              title: "EnrollPro: Learner Registry & Intake",
              desc: "Single Source of Truth for identity, SF1 staging, and class sectioning.",
            },
            {
              icon: BookOpen,
              title: "AIMS: Lessons & Remediation",
              desc: "LMS module for daily course content, online quizzes, and mastery analytics.",
            },
            {
              icon: Calendar,
              title: "ATLAS: Master Scheduling & Loading",
              desc: "Timetable manager for faculty teaching loads, room assignments, and campus mapping.",
            },
            {
              icon: ClipboardList,
              title: "SMART: Academic Grading & Records",
              desc: "Performance repository for quarterly grades, daily attendance, and historical class records.",
            },
            {
              icon: Recycle,
              title: "MRF: Campus Eco-Waste Management",
              desc: "Sanitation ledger for solid waste collections, kilogram tracking, and litter reports.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-center gap-4 rounded-xl bg-muted/5 backdrop-blur-sm border border-white/10 hover:bg-muted/10 hover:border-white/20 p-4 transition-all shadow-sm group">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-muted/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-white truncate">{feature.title}</h3>
                <p className="text-white/80 text-sm leading-tight  line-clamp-1">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default function Login() {
  const navigate = useNavigate();
  const { user, sessionExpired, setAuth, setSessionExpired } =
    useAuthStore();

  const settings = useSettingsStore() as SchoolMetaSettings;
  const schoolName = settings.schoolName || "EnrollPro";
  const acronym = useMemo(() => getAcronym(settings.schoolName), [settings.schoolName]);
  const isBosyEnrollmentOpen = settings.isBosyEnrollmentOpen;

  const apiBase = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

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

  const [showPassword, setShowPassword] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectTimeoutRef = useRef<number | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const savedId =
      localStorage.getItem("rememberedAccountName") ||
      localStorage.getItem("rememberedEmployeeId") ||
      localStorage.getItem("rememberedEmail");
    if (savedId) {
      setAccountName(savedId);
      setRememberMe(true);
    }
  }, []);

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
    (payload: AuthResponsePayload) => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      setAuth(payload.user);

      // Persistence logic
      if (rememberMe) {
        localStorage.setItem(
          "rememberedAccountName",
          payload.user.accountName || "",
        );
      } else {
        localStorage.removeItem("rememberedAccountName");
      }

      setError(null);
      setSuccess("Login successful! Redirecting...");

      sileo.success({
        title: "Welcome back",
        description: `Signed in as ${payload.user.firstName} ${payload.user.lastName}`,
      });

      if (payload.user.mustChangePassword) {
        setSuccess("Account security update required...");
        redirectTimeoutRef.current = window.setTimeout(() => {
          navigate("/change-password?origin=staff", { replace: true });
        }, 800);
        return;
      }

      const destination =
        payload.user.roles?.includes("TEACHER") || payload.user.roles?.includes("MRF")
          ? "/teacher/eosy"
          : "/dashboard";

      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate(destination, { replace: true });
      }, 800);
    },
    [navigate, setAuth, rememberMe, isBosyEnrollmentOpen],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Give 2 secs delay when the Sign In click and the Signing In... msg shows up
    await new Promise((resolve) => setTimeout(resolve, 700));

    try {
      const response = await api.post<AuthResponsePayload>("/auth/login", {
        accountName: accountName.trim(),
        password,
      });
      completeLogin(response.data);
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid Employee ID or password");
      } else {
        toastApiError(err as never);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (user && !user.mustChangePassword) {
    const homeRoute =
      user.roles?.includes("TEACHER") || user.roles?.includes("MRF") ? "/teacher/eosy" : "/dashboard";
    return (
      <Navigate
        to={homeRoute}
        replace
      />
    );
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

      <LoginDecorativeSidebar schoolName={schoolName} acronym={acronym} />

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
            <rect
              width="100%"
              height="100%"
              fill="url(#login-pixel-grid)"
            />
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
          <Card className="border border-slate-200/50 shadow-xl bg-muted/95 backdrop-blur-xl rounded-2xl overflow-hidden animate-scale-in">
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
              <CardTitle className="text-xl font-extrabold text-gray-900 pt-2">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-gray-600 text-base leading-tight">
                Sign in to continue to{" "}
                <span className="font-extrabold text-primary">EnrollPro</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-5 pt-4">
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 flex items-center gap-2.5 login-scale-in">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-base leading-tight font-extrabold text-red-700">
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
                    <p className="text-base leading-tight font-extrabold text-primary">
                      {success}
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="accountName"
                    className="text-gray-800 font-extrabold text-base leading-tight pl-1">
                    Employee ID
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200">
                        <User className="w-4 h-4 text-gray-500 transition-colors duration-200" />
                      </div>
                    </div>
                    <Input
                      id="accountName"
                      type="text"
                      placeholder="Employee ID or LR#"
                      value={accountName}
                      onChange={(event) => {
                        setAccountName(event.target.value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      className="pl-12 h-11 bg-slate-50/80 border-slate-200/60 hover:border-slate-300/80 focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-extrabold focus-visible:ring-offset-0"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-gray-800 font-extrabold text-base leading-tight pl-1">
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
                      className="pl-12 pr-11 h-11 bg-slate-50/80 border-slate-200/60 hover:border-slate-300/80 focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-extrabold focus-visible:ring-offset-0"
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

                <div className="flex items-center justify-between text-base leading-tight">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked as boolean)
                      }
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-gray-600 group-hover:text-gray-900 transition-colors font-extrabold text-base leading-tight">
                      Remember me
                    </span>
                  </label>
                  <span className="text-gray-400 text-base font-extrabold text-right leading-tight">
                    Forgot password?<br />Contact the System Admin.
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-extrabold text-base leading-tight rounded-xl shadow-emerald-sm hover:shadow-emerald transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-primary-foreground">
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
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
