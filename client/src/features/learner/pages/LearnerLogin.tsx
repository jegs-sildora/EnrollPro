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
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { Navigate, useNavigate } from "react-router";
import api from "@/shared/api/axiosInstance";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import depedLogo from "@/assets/DepEd-logo.png";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export function LookupForm() {
  const navigate = useNavigate();
  const { logoUrl, schoolName, accentForeground } = useSettingsStore();
  const { token, user, setAuth } = useLearnerAuthStore();

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

      // Store JWT + user in auth store
      setAuth(res.data.token, res.data.user);

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

  const strokeColor = accentForeground === "0 0% 0%" ? "stroke-black" : "stroke-white";

  // If already logged in as learner, skip login page
  if (token && user && !user.mustChangePassword) {
    return (
      <Navigate
        to="/learner"
        replace
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background implementation */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "hsl(var(--accent))",
        }}>
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.15]"
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="pixel-grid"
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
                className={strokeColor}
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="2"
                width="36"
                height="36"
                rx="2"
                fill="none"
                className={strokeColor}
                strokeWidth="1.5"
              />
              <rect
                x="2"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                className={strokeColor}
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                className={strokeColor}
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#pixel-grid)"
          />
        </svg>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      <Card className="w-full max-w-3xl mx-auto shadow-2xl border-primary/5 bg-white/90 backdrop-blur-xl p-2 sm:p-4">
        <CardHeader className="text-center pb-4 pt-6 px-6 sm:px-10">
          <div className="flex justify-center mb-6">
            <img
              src={fullLogoUrl}
              alt={`${schoolName || "School"} Logo`}
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold  text-foreground">
            {schoolName ? `${schoolName} Learner Portal` : "Learner Portal"}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-foreground mt-2">
            Log in to view your official class section, adviser details, and
            digital school records.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-10 pb-10">
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
                className="text-sm font-medium text-foreground ml-1">
                Learner Reference Number (LRN)
              </Label>
              <Input
                id="lrn"
                placeholder="e.g., 101234567890"
                className="h-11 text-base bg-background/50 border-input focus:bg-background transition-all font-bold"
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
                className="text-sm font-medium text-foreground ml-1">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 text-base bg-background/50 border-input focus:bg-background transition-all pr-10 font-bold"
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
              className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-[0.98]"
              disabled={!isFormValid || loading}>
              {loading ? "Verifying credentials..." : "Login to Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
