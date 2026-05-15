import { memo, useState, useEffect, useMemo } from "react";
import { useNavigate, Navigate } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ShieldCheck,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

// --- Sub-components for Optimization ---

const SecurityRequirements = memo(function SecurityRequirements({
  newPassword,
  confirmPassword,
}: {
  newPassword: string;
  confirmPassword: string;
}) {
  const rules = [
    { label: "Minimum 8 characters", pass: newPassword.length >= 8 },
    { label: "At least one uppercase letter", pass: /[A-Z]/.test(newPassword) },
    { label: "At least one number", pass: /[0-9]/.test(newPassword) },
    {
      label: "At least one special character",
      pass: /[^A-Za-z0-9]/.test(newPassword),
    },
    {
      label: "Passwords match",
      pass: newPassword.length > 0 && newPassword === confirmPassword,
    },
  ];

  return (
    <div className="rounded-xl bg-muted/50 p-4 border border-muted-foreground/10 space-y-3">
      <p className="font-bold uppercase  text-foreground/70 text-xs">
        Security Requirements
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {rules.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-2 text-sm font-bold transition-colors ${r.pass ? "text-emerald-600" : "text-foreground"}`}>
            {r.pass ? (
              <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Square className="h-3.5 w-3.5 shrink-0 opacity-50" />
            )}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
});

export default function ChangePassword() {
  const staffAuth = useAuthStore();
  const learnerAuth = useLearnerAuthStore();
  const { accentForeground } = useSettingsStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staff takes priority when both stores have a session (shouldn't happen in practice)
  const isStaff = !!(staffAuth.token && staffAuth.user);
  const auth = isStaff ? staffAuth : learnerAuth;
  const { user, token, setAuth, clearAuth } = auth;

  // Learner-like roles (LEARNER + MRF) both use the learner portal
  const isLearnerLikeRole = (role: string | null | undefined): boolean =>
    role === "LEARNER" || role === "MRF";

  // Fall back to any stored role when token is already gone (session expired on this page)
  const activeRole = user?.role ?? learnerAuth.user?.role ?? null;
  const homeRoute = isLearnerLikeRole(activeRole) ? "/learner" : "/dashboard";
  const loginRoute = isLearnerLikeRole(activeRole) ? "/learner/login" : "/login";

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const newPasswordValue = useWatch({
    control,
    name: "newPassword",
    defaultValue: "",
  });
  const confirmPasswordValue = useWatch({
    control,
    name: "confirmPassword",
    defaultValue: "",
  });

  // Clear error when typing
  useEffect(() => {
    const subscription = watch(() => {
      if (error) setError(null);
    });
    return () => subscription.unsubscribe();
  }, [watch, error]);

  const strokeColor = accentForeground === "0 0% 0%" ? "000000" : "ffffff";

  // Computed state for error highlighting
  const newPasswordInvalid = useMemo(
    () =>
      newPasswordValue.length > 0 &&
      (newPasswordValue.length < 8 ||
        !/[A-Z]/.test(newPasswordValue) ||
        !/[0-9]/.test(newPasswordValue) ||
        !/[^A-Za-z0-9]/.test(newPasswordValue)),
    [newPasswordValue],
  );

  const confirmPasswordInvalid = useMemo(
    () =>
      confirmPasswordValue.length > 0 &&
      newPasswordValue !== confirmPasswordValue,
    [newPasswordValue, confirmPasswordValue],
  );

  // Guard redirects
  if (!token || !user) {
    return <Navigate to={loginRoute} replace />;
  }

  // If already changed, go home
  if (!user.mustChangePassword) {
    return <Navigate to={homeRoute} replace />;
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch("/auth/change-password", {
        newPassword: data.newPassword,
      });

      setAuth(res.data.token, res.data.user);
      sileo.success({
        title: "Password Updated",
        description:
          "Your new password has been set. You can now access the system.",
      });
      
      // Delay slightly for toast visibility then navigate to the correct home
      const finalHome = isLearnerLikeRole(res.data.user?.role) ? "/learner" : "/dashboard";
      setTimeout(() => {
        navigate(finalHome, { replace: true });
      }, 500);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 400) {
        setError(axiosError.response.data?.message || "Invalid request");
      } else {
        sileo.error({
          title: "Update Failed",
          description:
            axiosError.response?.data?.message ||
            "Could not update password. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-['Instrument_Sans',sans-serif] px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');
        
        :root {
          --brand: hsl(var(--accent));
          --brand-foreground: hsl(var(--accent-foreground));
        }
      `}</style>

      {/* Pixel grid pattern bg */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: "var(--brand)" }}>
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect x='2' y='2' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='42' y='2' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='2' y='42' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='42' y='42' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 80px",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-3xl">
        <Card className="shadow-2xl border-none">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <CardTitle className="text-3xl font-bold ">
              Secure Your Account
            </CardTitle>
            <CardDescription className="text-base">
              For your security, you are required to change your temporary
              password before continuing.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4 px-8">
              <div className="space-y-2">
                <Label
                  htmlFor="newPassword"
                  className="text-sm font-bold">
                  New Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="newPassword"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••••••"
                    className={`font-bold h-12 pl-10 pr-10 bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary ${newPasswordInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}>
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-xs font-bold text-destructive uppercase ml-1">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-bold">
                  Confirm New Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="confirmPassword"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••••••"
                    className={`font-bold h-12 pl-10 bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary ${confirmPasswordInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    {...register("confirmPassword")}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-bold text-destructive uppercase ml-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <SecurityRequirements
                newPassword={newPasswordValue}
                confirmPassword={confirmPasswordValue}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4 px-8 pb-8 mt-2">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 shadow-sm mb-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <p className="text-sm font-semibold ">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
                disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Updating Security...
                  </>
                ) : (
                  "Update Password & Continue"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-foreground hover:text-primary h-8"
                onClick={() => {
                  clearAuth();
                  navigate(loginRoute);
                }}>
                Cancel and Return to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
