import { useState, useMemo } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { Navigate, useNavigate } from "react-router";
import api from "@/shared/api/axiosInstance";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import depedLogo from "@/assets/DepEd-logo.png";
import { LearnerPixelGridBackground } from "@/features/learner/components/LearnerPixelGridBackground";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export function LookupForm() {
  const navigate = useNavigate();
  const { logoUrl, schoolName } = useSettingsStore();
  const { user, setAuth, isHydrated } = useLearnerAuthStore();

  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullLogoUrl = useMemo(() => {
    if (!logoUrl) return depedLogo;
    if (logoUrl.startsWith("http")) return logoUrl;
    return `${API_BASE}${logoUrl}`;
  }, [logoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lrn || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/learner-login", { lrn, password });

      // Store learner user profile; auth session is maintained via httpOnly cookie.
      setAuth(res.data.user);

      sileo.success({
        title: "Welcome back!",
        description: `Logged in as ${res.data.user.firstName ?? lrn}.`,
      });

      // Redirect to change-password first if required
      if (res.data.user.mustChangePassword) {
        navigate("/change-password?origin=learner");
      } else {
        navigate("/learner");
      }
    } catch (err: unknown) {
      setError(
        isAxiosError(err)
          ? err.response?.data?.message ||
              "Invalid credentials. Please try again."
          : "An error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = lrn.length >= 12 && password.length >= 6;

  // If already logged in as learner, skip login page
  if (!isHydrated) {
    return null;
  }

  if (user && !user.mustChangePassword) {
    return (
      <Navigate
        to="/learner"
        replace
      />
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <LearnerPixelGridBackground />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/80 p-10 text-primary-foreground">
            <div className="space-y-5">
              <img
                src={fullLogoUrl}
                alt={`${schoolName || "School"} Logo`}
                className="h-24 w-auto object-contain"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-90">Hinigaran National High School</p>
                <h2 className="mt-3 text-3xl font-black leading-tight">Learner Portal</h2>
                <p className="mt-3 max-w-md text-sm opacity-90">
                  Securely access your enrollment status, adviser details, and official school records.
                </p>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-80">
              Mobile-ready access for every learner
            </p>
          </div>

          <Card className="rounded-none border-0 bg-transparent shadow-none">
            <CardHeader className="px-6 pb-4 pt-8 text-center sm:px-10 lg:text-left">
              <div className="mb-4 flex justify-center lg:hidden">
                <img
                  src={fullLogoUrl}
                  alt={`${schoolName || "School"} Logo`}
                  className="h-20 w-auto object-contain"
                />
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                Login to Learner Portal
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                Enter your LRN and password to continue.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-10 sm:px-10">
              <form
                onSubmit={handleSubmit}
                className="space-y-6">
            {error && (
              <Alert
                variant="destructive"
                className="py-3 bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="lrn"
                className="text-sm font-semibold text-foreground ml-1">
                Learner Reference Number (LRN)
              </Label>
              <Input
                id="lrn"
                placeholder="e.g., 101234567890"
                className="h-12 text-base bg-white border-slate-300 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 font-semibold"
                value={lrn}
                onChange={(e) =>
                  setLrn(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
                maxLength={12}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-semibold text-foreground ml-1">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 text-base bg-white border-slate-300 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 pr-10 font-semibold"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}>
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  className="text-[11px] text-foreground hover:text-primary transition-colors"
                  onClick={() =>
                    alert(
                      "Please contact the school registrar to reset your portal password.",
                    )
                  }>
                  Forgot Password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-black bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-lg transition-all"
              disabled={!isFormValid || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying credentials...
                </>
              ) : (
                "Login to Portal"
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
