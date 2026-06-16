import { memo, useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router";
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
import api, { getLearnerApi } from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";

import { useSettingsStore } from "@/store/settings.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

export { schema as changePasswordSchema };

// --- Shared Reusable Form Component ---

interface ChangePasswordFormProps {
  onSubmit: (newPassword: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  passwordLabel?: string;
  confirmLabel?: string;
  submitLabel?: string;
  loadingLabel?: string;
  children?: React.ReactNode;
}

export function ChangePasswordForm({
  onSubmit,
  loading,
  error,
  setError,
  passwordLabel = "New Password",
  confirmLabel = "Confirm New Password",
  submitLabel = "Set Password & Enter Portal",
  loadingLabel = "Updating Password...",
  children,
}: ChangePasswordFormProps) {
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const newPasswordValue = useWatch({ control, name: "newPassword", defaultValue: "" });
  const confirmPasswordValue = useWatch({ control, name: "confirmPassword", defaultValue: "" });

  useEffect(() => {
    const sub = watch(() => { if (error) setError(null); });
    return () => sub.unsubscribe();
  }, [watch, error, setError]);

  const newPasswordInvalid = useMemo(
    () => newPasswordValue.length > 0 && (
      newPasswordValue.length < 8 ||
      !/[A-Z]/.test(newPasswordValue) ||
      !/[0-9]/.test(newPasswordValue) ||
      !/[^A-Za-z0-9]/.test(newPasswordValue)
    ),
    [newPasswordValue],
  );

  const confirmPasswordInvalid = useMemo(
    () => confirmPasswordValue.length > 0 && newPasswordValue !== confirmPasswordValue,
    [newPasswordValue, confirmPasswordValue],
  );

  const handleFormSubmit = async (data: z.infer<typeof schema>) => {
    await onSubmit(data.newPassword);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      {children}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-sm font-bold">{passwordLabel}</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              id="newPassword"
              type={showPw ? "text" : "password"}
              placeholder="••••••••••••"
              className={`font-bold h-12 pl-10 pr-10 bg-muted/30 border-border focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl ${newPasswordInvalid ? "border-destructive/50 focus-visible:ring-destructive/20" : ""}`}
              {...register("newPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs font-bold text-destructive ml-1">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-bold">{confirmLabel}</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              id="confirmPassword"
              type={showPw ? "text" : "password"}
              placeholder="••••••••••••"
              className={`font-bold h-12 pl-10 bg-muted/30 border-border focus-visible:ring-4 focus-visible:ring-primary/15 rounded-xl ${confirmPasswordInvalid ? "border-destructive/50 focus-visible:ring-destructive/20" : ""}`}
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs font-bold text-destructive ml-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <SecurityRequirements newPassword={newPasswordValue} confirmPassword={confirmPasswordValue} />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive shadow-sm">
              <AlertCircle className="size-4 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          className="w-full h-12 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-primary-foreground"
          disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{loadingLabel}</>
          ) : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// --- Sub-components for Optimization ---

export const SecurityRequirements = memo(function SecurityRequirements({
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

  const isLearner = Boolean(learnerAuth.user);
  const auth = isLearner ? learnerAuth : staffAuth;

  const strokeColor = accentForeground === "0 0% 0%" ? "000000" : "ffffff";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = auth.user;
  const hasSession = Boolean(auth.user);

  if (!hasSession || !user) {
    return <Navigate to={isLearner ? "/learner/login" : "/staff/login"} replace />;
  }

  // Learner must have a token to make authenticated requests
  if (isLearner && !learnerAuth.token) {
    return <Navigate to="/learner/login" replace />;
  }

  if (!isLearner && !(user as { mustChangePassword?: boolean }).mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLearner && !learnerAuth.requiresPasswordReset) {
    return <Navigate to="/learner/portal" replace />;
  }

  const handleSubmit = async (newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      if (isLearner) {
        const token = useLearnerAuthStore.getState().token;
        if (!token) {
          setError("Session not found. Please log in again.");
          setLoading(false);
          return;
        }
        const learnerApi = getLearnerApi(token);
        await learnerApi.post("/learner/change-password", { newPassword });

        const lu = user as { lrn: string; middleName: string | null; schoolName: string; schoolAcronym: string; gradeLevelName: string | null; sectionName: string | null };
        learnerAuth.setAuth(
          {
            id: user.id,
            lrn: lu.lrn,
            firstName: user.firstName,
            lastName: user.lastName,
            middleName: lu.middleName ?? null,
            schoolName: lu.schoolName,
            schoolAcronym: lu.schoolAcronym,
            gradeLevelName: lu.gradeLevelName ?? null,
            sectionName: lu.sectionName ?? null,
          },
          token,
        );

        sileo.success({
          title: "Password Updated",
          description: "Your new password has been set. You can now access the Learner Portal.",
        });

        setTimeout(() => {
          window.location.replace("/learner/portal");
        }, 500);
      } else {
        const res = await api.patch("/auth/change-password", { newPassword });

        staffAuth.setAuth(res.data.user);
        sileo.success({
          title: "Password Updated",
          description: "Your new password has been set. You can now access the system.",
        });

        const roles = res.data.user?.roles ?? [];
        const finalHome = roles.some((r: string) => r === "TEACHER" || r === "MRF")
          ? "/reading-assessment"
          : "/dashboard";
        setTimeout(() => {
          window.location.replace(finalHome);
        }, 500);
      }
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
              Activate Official Account
            </CardTitle>
            <CardDescription className="text-base">
              Please replace the initial access key provided by the Registrar with your own private password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8">
            <ChangePasswordForm
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              setError={setError}
              passwordLabel="Official Password"
              confirmLabel="Confirm Official Password"
              submitLabel="Activate Account & Enter System"
              loadingLabel="Updating Official Password..."
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
