import { memo, useState, useEffect, useMemo } from "react";
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
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
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
      <p className="font-bold uppercase text-foreground/70 text-xs">
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

export function ChangePasswordModal() {
  const { user, token, setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
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

  useEffect(() => {
    const subscription = watch(() => {
      if (error) setError(null);
    });
    return () => subscription.unsubscribe();
  }, [watch, error]);

  const isOpen = !!(token && user?.mustChangePassword);

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
      reset();
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
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 text-center bg-primary/5 pt-8 pb-6 px-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <DialogTitle className="text-3xl font-bold">
            Secure Your Account
          </DialogTitle>
          <DialogDescription className="text-base font-medium">
            For your security, you are required to change your temporary
            password before continuing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword" size="sm" className="font-bold">
                New Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50 group-focus-within:text-primary transition-colors" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs font-bold text-destructive uppercase ml-1">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" size="sm" className="font-bold">
                Confirm New Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50 group-focus-within:text-primary transition-colors" />
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

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 shadow-sm"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-sm font-semibold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="flex flex-col gap-3 px-8 pb-8 sm:flex-col">
            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
              disabled={loading}
            >
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
                reset();
              }}
            >
              Cancel and Return to Login
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
